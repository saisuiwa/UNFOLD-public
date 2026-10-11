// Hiragana lyrics -> kanji-kana mixed lyrics, without sending anything anywhere: the lyrics are copied with a request for an AI of your choice,
// and the answer is pasted back. These are the pure parts (the request, reading the answer, checking it against the lyrics).
export const KANJI_REQUEST_HEAD='次の歌詞を、読みやすい漢字かな交じりの表記に直してください。\n'
 +'・行数と行の順番は変えないでください（1行は1行のまま）。\n'
 +'・言葉の追加、削除、言い換えはしないでください。読みと意味はそのままにします。\n'
 +'・* と / の記号は、そのままの位置に残してください。\n'
 +'・説明や番号、空行は出さず、直した歌詞だけを、元と同じ行数で出してください。\n'
 +'\n--- 歌詞 ---\n';

/** The text to hand to an AI: the request and the lyric lines, one per line. */
export const kanjiRequest=lines=>KANJI_REQUEST_HEAD+lines.join('\n')+'\n';

const fence=/^\s*```/;
/** The answer pasted back, cleaned: no code fences, numbering added by the AI, or blank lines. */
export function readKanjiAnswer(text){
 let lines=String(text??'').split(/\r?\n/).filter(l=>!fence.test(l)).map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim()!=='');
 const numbered=/^\s*(?:\d+|[０-９]+)\s*[.．:：)）、]\s*/;
 if(lines.length>1&&lines.every(l=>numbered.test(l)))lines=lines.map(l=>l.replace(numbered,''));
 const head=lines.findIndex(l=>/^-{2,}\s*歌詞\s*-{2,}$/.test(l.trim()));
 if(head>=0)lines=lines.slice(head+1);
 return lines.map(l=>l.trim());
}

const marks=s=>({stars:(s.match(/\*/g)||[]).length,slashes:(s.match(/[/／]/g)||[]).length});
/**
 * Checks the answer against the lyric lines. `ok` only when the line counts match (the lines are then paired one to one).
 * `warnings` lists lines whose * or / marks differ from the original, and lines that came back unchanged.
 */
export function checkKanjiAnswer(before,answerText){
 const after=readKanjiAnswer(answerText),result={ok:false,after,pairs:[],changed:0,problems:[],warnings:[]};
 if(!after.length){result.problems.push('貼り付けた内容が空です。');return result;}
 if(after.length!==before.length){result.problems.push(`行数が合いません（歌詞は ${before.length} 行、貼り付けは ${after.length} 行）。AIに「行数を変えないで」と伝えて、もう一度直してもらってください。`);return result;}
 result.ok=true;
 before.forEach((raw,i)=>{
  const next=after[i],a=marks(raw),b=marks(next);
  if(next!==raw)result.changed++;
  if(a.stars!==b.stars||a.slashes!==b.slashes)result.warnings.push(`${i+1}行目：強調の * や 改行の / の数が元と違います。`);
  result.pairs.push({index:i,before:raw,after:next,changed:next!==raw});
 });
 if(!result.changed)result.warnings.push('どの行も元と同じです。漢字に直っていないようです。');
 return result;
}
