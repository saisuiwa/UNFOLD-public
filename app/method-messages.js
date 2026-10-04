// The GPU compiler's messages in plain Japanese. The editor shows the original text next to them.
const RULES = [
  [/^'(.+?)' : undeclared identifier/, m => `「${m[1]}」という名前が見つかりません（打ち間違いや、宣言し忘れかも）。`],
  [/^'(.+?)' : function already has a body/, m => `「${m[1]}」は、もともと用意されている関数と同じ名前です。別の名前にしてね。`],
  [/^'(.+?)' : redefinition/, m => `「${m[1]}」を2回宣言しています。`],
  [/syntax error/, () => '書き方がおかしい所があります（; ) { } の付け忘れなど）。'],
  [/cannot convert from '(.+?)' to '(.+?)'/, m => `型が合っていません（${m[1]} を ${m[2]} に入れようとしています）。`],
  [/wrong operand types/, () => '足し算や掛け算などで、型の組み合わせが合っていません（例: float と vec2 の混ぜ方）。'],
  [/^'(.+?)' : no matching overloaded function found/, m => `「${m[1]}」に渡している値の型や数が、合っていません。`],
  [/not enough data provided for construction/, () => 'vec2 や vec3 を作るときの値が足りません。'],
];

export function describeGlError(message) {
  for (const [pattern, describe] of RULES) {
    const m = pattern.exec(message);
    if (m) return describe(m);
  }
  return message;
}
