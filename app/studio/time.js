/** Integer microseconds; derive each timestamp from its frame/sample index. */
export class StudioError extends Error {
 constructor(code,issues=[]){super(issues[0]?.message||code);this.name='StudioError';this.code=code;this.issues=issues;}
}
export function integerUs(value){if(!Number.isSafeInteger(value)||value<0)throw new StudioError('INVALID_TIME');return value;}
export function frameUs(index,fps=30){integerUs(index);if(!Number.isSafeInteger(fps)||fps<=0)throw new StudioError('INVALID_FPS');return integerUs(Math.round(index*1e6/fps));}
function frameIndex(us,fps,round){const n=Math.round(us*fps/1e6);return frameUs(n,fps)===us?n:round(us*fps/1e6);}
export function rangeFrames(startUs,endUs,fps=30){integerUs(startUs);integerUs(endUs);if(endUs<=startUs)throw new StudioError('EMPTY_RANGE');const startFrame=frameIndex(startUs,fps,Math.floor),endFrame=frameIndex(endUs,fps,Math.ceil);return {startFrame,endFrame,startUs:frameUs(startFrame,fps),endUs:frameUs(endFrame,fps),fps};}
export function outputProjectUs(range,index){integerUs(index);if(index>=range.endFrame-range.startFrame)throw new StudioError('FRAME_OUT_OF_RANGE');return frameUs(range.startFrame+index,range.fps||30);}
export function sceneLocalUs(scene,projectUs){integerUs(projectUs);return projectUs-scene.originUs;}
export function sampleAt(us,rate=48000){return Math.round(us*rate/1e6);}
