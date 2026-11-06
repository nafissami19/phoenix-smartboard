import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile, withCurrentBrand} from '../src/lib/profile-defaults.ts';
import {BUILTIN_THEMES} from '../src/lib/theme-pack.ts';
import {BRANDING} from '../src/config/branding.ts';

test('the old Electric Blue default accent moves to Phoenix Crimson', () => {
  assert.equal(normalizeProfile({accent: '#0062FF'}).accent, BRANDING.COLORS.PRIMARY);
  assert.equal(BRANDING.COLORS.PRIMARY, '#e63946');
});

test('a teacher-chosen accent is kept', () => {
  assert.equal(normalizeProfile({accent: '#22aa66'}).accent, '#22aa66');
});

test('a saved stock Ember pack picks up the current Ember colors', () => {
  const ember = BUILTIN_THEMES.find(theme => theme.id === 'phoenix-ember')!;
  const old = {...ember, colors: {...ember.colors, accent: '#0062ff', panel: '#17171c'}};
  const migrated = withCurrentBrand({theme: old});
  assert.deepEqual(migrated.theme?.colors, ember.colors);
});

test('other saved packs are untouched', () => {
  const pack = {...BUILTIN_THEMES.find(theme => theme.id !== 'phoenix-ember')!};
  pack.colors = {...pack.colors, accent: '#0062ff'};
  assert.equal(withCurrentBrand({theme: pack}).theme?.colors.accent, '#0062ff');
});
