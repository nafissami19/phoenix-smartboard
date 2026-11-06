import type {Point} from '../db/schema';
export type GuideEdge={a:Point;b:Point};
/** Signed shortest rotation, continuous across the +/-PI boundary. */
export function angleDelta(from:number,to:number):number {return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
/** Segments sampled at most 3 degrees apart for a smooth compass arc. */
export function arcEdges(center:Point,radius:number,start:number,sweep:number):GuideEdge[] {
 if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(start)||!Number.isFinite(sweep))return [];
 const count=Math.min(240,Math.max(1,Math.ceil(Math.abs(sweep)/(Math.PI/60))));
 const point=(a:number):Point=>({x:center.x+radius*Math.cos(a),y:center.y+radius*Math.sin(a)});
 return Array.from({length:count},(_,i)=>({a:point(start+sweep*i/count),b:point(start+sweep*(i+1)/count)}));
}
export function projectToEdge(point:Point,edge:GuideEdge):Point {
 const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((point.x-edge.a.x)*dx+(point.y-edge.a.y)*dy)/length)):0;
 return {x:edge.a.x+t*dx,y:edge.a.y+t*dy,p:point.p};
}
/** The edges of the single instrument (ruler, compass arc…) closest to the point, if one is within tolerance. */
export function nearbyGuide(point:Point,guides:Iterable<GuideEdge[]>,tolerance=22):GuideEdge[]|undefined {
 let closest:GuideEdge[]|undefined,best=tolerance;
 for(const edges of guides){const edge=nearbyEdge(point,edges,best);if(edge){best=Math.hypot(projectToEdge(point,edge).x-point.x,projectToEdge(point,edge).y-point.y);closest=edges;}}
 return closest;
}
/**
 * Snap one sample onto the nearest segment of the chosen instrument. Re-picking the segment per sample
 * follows a compass arc smoothly. Returns undefined once the pen has left the edge, so the rest of the
 * stroke is free ink.
 */
export function snapToGuide(point:Point,edges:GuideEdge[],tolerance=30):Point|undefined {
 const edge=nearbyEdge(point,edges,tolerance);
 return edge?projectToEdge(point,edge):undefined;
}
export function nearbyEdge(point:Point,edges:GuideEdge[],tolerance=22):GuideEdge|undefined {
 let closest:GuideEdge|undefined,best=tolerance;
 for(const edge of edges){const p=projectToEdge(point,edge),distance=Math.hypot(p.x-point.x,p.y-point.y);if(distance<best){best=distance;closest=edge;}}
 return closest;
}
