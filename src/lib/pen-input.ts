import type {BoardObject} from '@/db/schema';

/** True when both lists hold the same objects in the same order (nothing was erased or changed). */
export function sameObjects(a:readonly BoardObject[],b:readonly BoardObject[]):boolean{
  return a===b||(a.length===b.length&&a.every((object,i)=>object===b[i]));
}

/**
 * Stored pressure for one pen sample. Pens that report 0 (some IR panels and drivers never send
 * pressure) are treated as "no pressure" so the stroke keeps its normal width instead of a hairline.
 */
export function samplePressure(pointerType:string,pressureEnabled:boolean|undefined,pressure:number):number|undefined{
  if(pointerType!=='pen'||!pressureEnabled||!(pressure>0))return undefined;
  return Math.min(1,Math.max(0.05,pressure));
}

/** Minimum spacing between stored ink samples, in world units: about 0.75 screen pixels at any zoom. */
export function minSampleSpacing(scale:number):number{
  return 0.75/Math.max(scale,0.01);
}

/** Palm contact only switches to erasing when the teacher enabled the palm eraser. */
export function isPalmContact(pointerType:string,contactSize:number,palmEraser:boolean):boolean{
  return palmEraser&&(pointerType==='touch'||pointerType==='pen')&&contactSize>=32;
}

/** A large finger contact while the palm eraser is off is a resting hand: ignore it rather than drawing. */
export function isRestingHand(pointerType:string,contactSize:number,palmEraser:boolean):boolean{
  return !palmEraser&&pointerType==='touch'&&contactSize>=40;
}

/**
 * A second finger may start a pinch only right at the beginning of a stroke (the first finger was
 * part of the pinch). Later, it is a stray knuckle or hand and must not discard the ink.
 */
export function secondTouchMayPinch(drawingPoints:number,drawingForMs:number):boolean{
  return drawingPoints<4||drawingForMs<200;
}
