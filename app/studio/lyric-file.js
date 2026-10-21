// 歌詞ファイル（LRC / SRT / JSON / TXT）を、シーケンスと同じ読み方で歌詞の文書（lyric-document.js）にする。DOMなし。
// 時刻つき（.lrc / .srt / .json と、中身が LRC・SRT の .txt）は parseTimings → importTimedLyrics、ただの文章の .txt は parseLyrics（時刻は仮）。
// シーケンスの「歌詞の時刻ファイル」（.json の lyricDocument）は、そのまま読み直す。動きも残すが、コードの動きは STUDIO で許可がいるので普通の動きに戻す。
import {parseLyrics,importTimedLyrics,cleanLyricDocument} from '../lyric-document.js';
import {parseTimings} from '../lyric-timings.js?v=2';
import {assignLyricMotions} from '../lyric-motion.js?v=28';
export const LYRIC_FILE_ACCEPT='.lrc,.srt,.json,.txt';
const TIMED=/^\s*\[\d+:\d+(?:\.\d+)?\]|\d:\d{1,2}[,.]\d{1,3}\s*-->/m;
export function readLyricFile(text,name=''){
 text=String(text??'').replace(/^\uFEFF/,'');
 try{
  if(/\.json$/i.test(name)){const restored=cleanLyricDocument(JSON.parse(text)?.lyricDocument);if(restored){for(const e of restored.events)if(e.motion?.code)e.motion=null;return assignLyricMotions(restored,{style:restored.style,seed:restored.seed,preserveExisting:true,plain:true});}}
  const timed=/\.(json|lrc|srt)$/i.test(name)||TIMED.test(text);
  return assignLyricMotions(timed?importTimedLyrics(parseTimings(text,name),'file'):parseLyrics(text),{style:'readable',seed:7,plain:true});
 }catch(e){throw new Error(`歌詞ファイル「${name}」を読めませんでした：${e.message}`);}
}
