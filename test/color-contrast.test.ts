import test from 'node:test';
import assert from 'node:assert/strict';
import {contrastRatio,mixHex,onColor,parseHex,readableOn,relativeLuminance,DARK_INK} from '../src/lib/color-contrast';

test('WCAG luminance and contrast match the reference values',()=>{
  assert.equal(relativeLuminance('#ffffff'),1);assert.equal(relativeLuminance('#000000'),0);
  assert.equal(Number(contrastRatio('#ffffff','#000000').toFixed(2)),21);
  assert.equal(Number(contrastRatio('#777777','#ffffff').toFixed(2)),4.48);
  assert.deepEqual(parseHex('#abc'),[170,187,204]);assert.equal(parseHex('red'),undefined);
});

test('mixHex matches CSS color-mix in sRGB',()=>{
  assert.equal(mixHex('#ffffff','#000000',.5),'#808080');
  assert.equal(mixHex('#0062ff','#000000',.92),'#005aeb');
  assert.equal(mixHex('#0062ff','#000000',1),'#0062ff');
});

test('readableOn reaches 4.5:1 against the panel by lightening in dark modes and darkening in light modes',()=>{
  const dark=readableOn('#0062ff','#17171c','dark');assert.ok(contrastRatio(dark,'#17171c')>=4.5);assert.ok(relativeLuminance(dark)>relativeLuminance('#0062ff'));
  const light=readableOn('#facc15','#ffffff','light');assert.ok(contrastRatio(light,'#ffffff')>=4.5);assert.ok(relativeLuminance(light)<relativeLuminance('#facc15'));
  assert.equal(readableOn('#ffffff','#000000','dark'),'#ffffff');
});

test('onColor picks white or dark ink, whichever contrasts more',()=>{
  assert.equal(onColor('#0062ff'),'#ffffff');assert.equal(onColor('#facc15'),DARK_INK);
  for(const color of ['#183c36','#966b24','#7c3aed','#e11d48'])assert.ok(contrastRatio(onColor(color),color)>=Math.max(contrastRatio('#ffffff',color),contrastRatio(DARK_INK,color)));
});
