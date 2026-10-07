// The custom-method file (.unfoldmethod): a small readable text (JSON) file with one or more methods, for handing a method to someone else.
// A method in it is written like a method inside a .unfold project (id, name, symbol, vertex), so the same checks read both; what the file
// says about status or hash is never used — the code decides.
import { validateEmbedded } from './method-project.js';

export const METHOD_FILE = { format: 'unfold-method', version: 1, extension: '.unfoldmethod', maxChars: 600000, maxName: 30 };

export function buildMethodFile(records) {
  const methods = records.map(c => ({id:c.id,name:c.name,symbol:c.symbol,...(c.code?{engine:'image-js',code:c.code}:{vertex:c.vertex}),look:null,params:[]}));
  return `${JSON.stringify({ format: METHOD_FILE.format, version: records.some(c=>c.code)?2:METHOD_FILE.version, methods }, null, 2)}\n`;
}

// the name of the method as a file name, without what file names cannot hold
export function methodFileName(record) {
  const clean = String(record?.name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/^\.+/, '');
  return `${[...clean].slice(0, METHOD_FILE.maxName).join('') || 'method'}${METHOD_FILE.extension}`;
}

// -> { methods, problems }: the methods that passed the checks and a Japanese line for everything that did not
export function parseMethodFile(text) {
  const fail = message => ({ methods: [], problems: [message] });
  if (typeof text !== 'string') return fail('ファイルの中身が読めません。');
  if (text.length > METHOD_FILE.maxChars) return fail('ファイルが大きすぎます。自作メソッドのファイルではないかもしれません。');
  let data;
  try { data = JSON.parse(text); } catch { return fail('ファイルの中身が読めません（自作メソッドのファイルではないかも）。'); }
  if (!data || typeof data !== 'object' || data.format !== METHOD_FILE.format) return fail('UNFOLDの自作メソッドのファイルではありません。');
  if (typeof data.version === 'number' && data.version > 2) return fail('新しい形式のファイルなので、読み込めませんでした。UNFOLDを新しくしてから、もう一度試してね。');
  if (!Array.isArray(data.methods) || !data.methods.length) return fail('メソッドが入っていません。');
  return validateEmbedded(data.methods,data.version===2?4:3);
}
