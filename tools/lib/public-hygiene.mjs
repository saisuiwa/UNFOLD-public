// What must not appear in anything that goes public: a nickname of the author or of the AI, a Mac user folder
// (/Users/<name>/…), a personal mail address. Used by tools/test/public-hygiene.test.mjs (the tracked files) and by
// tools/public_mirror.mjs (every file version and commit message of the public copy).
// The words are put together from pieces so that this file does not match itself.
export const HYGIENE_RULES = [
  [new RegExp('/Users/' + '[A-Za-z0-9._-]+/'), 'a Mac user folder: write ~/… or a path relative to the repository'],
  [new RegExp('ひろ' + 'くん'), 'the author’s nickname: write 作者'],
  [new RegExp('コ' + 'コ(?![アナッ])'), 'the AI’s nickname: write Claude'],
  [new RegExp('[A-Za-z0-9._%+-]+@' + '(gmail|yahoo|icloud|outlook|hotmail)\\.[a-z.]+', 'i'), 'a personal mail address'],
];

/** The rules a text breaks, as [{line, what}] (line is 1-based). */
export function hygieneProblems(text, rules = HYGIENE_RULES) {
  const found = [];
  String(text).split('\n').forEach((line, i) => {
    for (const [re, what] of rules) if (re.test(line)) found.push({line: i + 1, what});
  });
  return found;
}
