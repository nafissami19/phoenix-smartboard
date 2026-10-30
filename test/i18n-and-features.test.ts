import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, DICTIONARY } from '../src/lib/i18n';
import {
  createEquipment,
  isEquipment,
  pourBetweenEquipment,
  equipmentPolygon,
  validEquipmentData,
  VESSELS,
} from '../src/lib/chemistry-equipment';
import {
  listTrashSnapshots,
  restoreTrashSnapshot,
  deleteTrashSnapshot,
  localRequest,
} from '../src/lib/local-store';
import { exportLesson } from '../src/lib/lesson-bundle';
import type { StrokeObject, ShapeObject } from '../src/db/schema';

test('i18n translate resolves English and Bangla keys and falls back gracefully', () => {
  assert.equal(translate('save', 'en'), 'Save');
  assert.equal(translate('save', 'bn'), 'সংরক্ষণ');
  assert.equal(translate('lock', 'en'), 'Lock');
  assert.equal(translate('lock', 'bn'), 'লক করুন');
  assert.equal(translate('unknown_key', 'en', 'Fallback Text'), 'Fallback Text');

  // Verify all English keys have Bangla translations
  const enKeys = Object.keys(DICTIONARY.en);
  const bnKeys = Object.keys(DICTIONARY.bn);
  for (const key of enKeys) {
    assert.ok(bnKeys.includes(key), `Missing Bangla translation for key: ${key}`);
    assert.ok(DICTIONARY.bn[key].length > 0, `Empty Bangla translation for key: ${key}`);
  }
});

test('chemistry equipment includes burette and bunsen-burner with valid geometry', () => {
  assert.ok('burette' in VESSELS, 'Burette vessel definition should exist');
  assert.ok('bunsen-burner' in VESSELS, 'Bunsen burner vessel definition should exist');

  const burette = createEquipment('burette', 50, 50, '#112233', 'HCl');
  assert.ok(isEquipment(burette));
  assert.equal(burette.chemistry.vessel, 'burette');
  assert.equal(VESSELS[burette.chemistry.vessel].capacity, 50);
  assert.ok(validEquipmentData(burette.chemistry));
  assert.ok(equipmentPolygon(burette).length > 3);

  const burner = createEquipment('bunsen-burner', 100, 100, '#112233');
  assert.ok(isEquipment(burner));
  assert.equal(burner.chemistry.vessel, 'bunsen-burner');
  assert.equal(VESSELS[burner.chemistry.vessel].capacity, 0);
  assert.ok(validEquipmentData(burner.chemistry));
  assert.ok(equipmentPolygon(burner).length > 3);

  // Pour from burette into beaker
  const beaker = createEquipment('beaker', 250, 50, '#112233');
  const poured = pourBetweenEquipment([burette, beaker], burette.id, beaker.id, 15).filter(isEquipment);
  assert.equal(poured[0].chemistry.solution.volumeMl, 35);
  assert.equal(poured[1].chemistry.solution.volumeMl, 15);
});

test('stroke and shape objects support locked and groupId properties', () => {
  const stroke: StrokeObject = {
    id: 'stroke-1',
    kind: 'stroke',
    tool: 'pen',
    color: '#ff0000',
    width: 4,
    points: [{ x: 10, y: 10, p: 0.5 }, { x: 20, y: 20, p: 0.5 }],
    locked: true,
    groupId: 'group-abc',
  };
  assert.equal(stroke.locked, true);
  assert.equal(stroke.groupId, 'group-abc');

  const shape: ShapeObject = {
    id: 'shape-1',
    kind: 'shape',
    shape: 'rect',
    x: 0,
    y: 0,
    w: 50,
    h: 50,
    rotation: 0,
    color: '#00ff00',
    width: 2,
    filled: true,
    locked: false,
    groupId: 'group-abc',
  };
  assert.equal(shape.locked, false);
  assert.equal(shape.groupId, 'group-abc');
});

test('trash recovery operations list, restore, and delete snapshots', async () => {
  // Create a lesson
  const res = await localRequest('/api/notebooks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Lesson for Trash Test' }),
  });
  const { notebook } = await res.json();

  // Export to create a backup blob, then delete the lesson to trigger recovery save
  const blob = await exportLesson(notebook.id);
  assert.ok(blob.size > 0);

  // Delete lesson (this places recovery snapshot)
  await localRequest(`/api/notebooks/${notebook.id}`, { method: 'DELETE' });

  // List trash snapshots
  const trash = await listTrashSnapshots();
  assert.ok(Array.isArray(trash));
  const snapshot = trash.find(item => item.lessonId === notebook.id);
  assert.ok(snapshot, 'Deleted lesson should appear in trash snapshots');

  // Restore lesson
  const restoredId = await restoreTrashSnapshot(snapshot.id);
  assert.ok(restoredId);

  // Check restored lesson exists
  const checkRes = await localRequest(`/api/notebooks/${restoredId}`);
  assert.equal(checkRes.status, 200);

  // Delete trash snapshot
  await deleteTrashSnapshot(snapshot.id);
  const remaining = await listTrashSnapshots();
  assert.ok(!remaining.some(item => item.id === snapshot.id));
});
