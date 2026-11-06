/** Drift-free stopwatch: time comes from a monotonic clock (performance.now()), never from counting interval ticks. */
export type StopwatchState={accumulated:number;startedAt:number|null};
export const STOPWATCH_IDLE:StopwatchState={accumulated:0,startedAt:null};
export function stopwatchElapsed(state:StopwatchState,now:number){return state.accumulated+(state.startedAt==null?0:Math.max(0,now-state.startedAt));}
export function stopwatchStart(state:StopwatchState,now:number):StopwatchState{return state.startedAt==null?{...state,startedAt:now}:state;}
export function stopwatchStop(state:StopwatchState,now:number):StopwatchState{return state.startedAt==null?state:{accumulated:stopwatchElapsed(state,now),startedAt:null};}
export function stopwatchToggle(state:StopwatchState,now:number){return state.startedAt==null?stopwatchStart(state,now):stopwatchStop(state,now);}
