import test from 'node:test';import assert from 'node:assert/strict';
const m=await import('../../app/lyric-audio-range.js').catch(()=>({}));
test('negative offset preserves leading silence; positive trims the source',()=>{assert.equal(typeof m.audioBlock,'function');const b={sampleRate:4,numberOfChannels:1,length:4,getChannelData:()=>Float32Array.of(1,2,3,4)};assert.deepEqual([...m.audioBlock(b,-.5,0,8,1)],[0,0,1,2,3,4,0,0]);assert.deepEqual([...m.audioBlock(b,.5,0,4,1)],[3,4,0,0]);});
