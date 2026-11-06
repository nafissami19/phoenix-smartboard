import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFile } from '../src/lib/media.js';

test('classifyFile identifies PPTX, PPT, and ODP files as presentations', () => {
  const pptxFile = new File(['dummy'], 'lecture-01.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const pptFile = new File(['dummy'], 'old-lecture.ppt', { type: 'application/vnd.ms-powerpoint' });
  const odpFile = new File(['dummy'], 'open-office.odp', { type: 'application/vnd.oasis.opendocument.presentation' });
  const pdfFile = new File(['dummy'], 'handout.pdf', { type: 'application/pdf' });

  assert.equal(classifyFile(pptxFile).kind, 'presentation');
  assert.equal(classifyFile(pptFile).kind, 'presentation');
  assert.equal(classifyFile(odpFile).kind, 'presentation');
  assert.equal(classifyFile(pdfFile).kind, 'pdf');
});

test('pptx file titles are cleaned properly when importing', () => {
  const cleanTitle = (filename: string) => filename.replace(/\.(pptx|ppt|odp)$/i, '');
  assert.equal(cleanTitle('Physics Lecture 1.pptx'), 'Physics Lecture 1');
  assert.equal(cleanTitle('Chemistry Lab Notes.PPTX'), 'Chemistry Lab Notes');
  assert.equal(cleanTitle('Biology Diagrams.ppt'), 'Biology Diagrams');
  assert.equal(cleanTitle('History Overview.odp'), 'History Overview');
});
