// How an import of an app module with a version looks: './project.js?v=9'. The name must start right after "/" or a quote,
// so 'project.js' does not match 'lyric-project.js?v=9' or 'method-project.js?v=10' (other modules whose names end the same way).

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// a RegExp with the global flag; group 1 is the text up to and including "?v=", group 2 the number
export const versionedImport = name => new RegExp(`(?<![\\w-])(${escape(name)}\\?v=)(\\d+)`, 'g');

// the same thing as a pattern for `git grep -E` (no look-behind there): it matches one char before the name, which is "/" or a quote
export const versionedImportGrep = name => `[/'"]${escape(name)}\\?v=[0-9]+`;
