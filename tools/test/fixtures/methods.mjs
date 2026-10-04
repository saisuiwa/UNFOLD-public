// Sample methods for the tests. GOOD ones pass the guard. HOSTILE ones must be stopped: `error` is a piece of the message we expect.
export const GOOD = {
  vortex: `vec3 userMethod(vec2 p, float amount) {
  float r = length(p);
  vec2 q = rot(amount * 3.4 / (r + .35)) * p * (1. - amount * .6 * exp(-r * .5));
  return vec3(q, -amount * .9 * exp(-r * r * .7));
}`,
  wave: `vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  q.x += sin(p.y * 6. + uSeed) * amount * .6;
  q.y += sin(p.x * 5. + uSeed) * amount * .48;
  return vec3(q, 0.);
}`,
  loopAndHelper: `float wobble(float x) { return sin(x) * .5; }
vec3 userMethod(vec2 p, float amount) {
  vec2 q = p;
  for (int i = 0; i < 24; i++) {
    q += vec2(sin(float(i) + q.y), cos(float(i) + q.x)) * .01 * amount;
  }
  gKind = 2.;
  return vec3(q, wobble(amount));
}`,
  commentsAreIgnored: `// while (true) { discard; }
/* #define X 1
   uniform float u; */
vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`,
  nanValue: `vec3 userMethod(vec2 p, float amount) { float z = 0.; return vec3(p / z, 0. / z); }`,
  hugeValue: `vec3 userMethod(vec2 p, float amount) { return vec3(p * 1e30, 1e30); }`,
};

const wrap = body => `vec3 userMethod(vec2 p, float amount) {\n  vec2 q = p;\n${body}\n  return vec3(q, 0.);\n}`;

export const HOSTILE = {
  empty: { src: '', error: '空' },
  tooLong: { src: `vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }\n// ${'a'.repeat(8100)}`, error: '8000' },
  whileTrue: { src: wrap('  while (true) { q.x += 1.; }'), error: 'while' },
  doWhile: { src: wrap('  do { q.x += 1.; } for (int i = 0; i < 1; i++) { }'), error: 'do' },
  nestedTooMany: { src: wrap('  for (int i = 0; i < 16; i++) {\n    for (int j = 0; j < 16; j++) { q.x += .001; }\n  }'), error: '合計' },
  fiveLoopsOf64: { src: wrap(Array.from({ length: 5 }, () => '  for (int i = 0; i < 64; i++) { q.x += .001; }').join('\n')), error: '合計' },
  loopTooLong: { src: wrap('  for (int i = 0; i < 100; i++) { q.x += .001; }'), error: '1つあたり' },
  loopVariableChanged: { src: wrap('  for (int i = 0; i < 10; i++) { i--; }'), error: 'ループ変数' },
  loopBoundNotLiteral: { src: wrap('  int n = 5;\n  for (int i = 0; i < n; i++) { q.x += .001; }'), error: '数字' },
  loopWithoutBraces: { src: wrap('  for (int i = 0; i < 4; i++) q.x += .001;'), error: '{ }' },
  loopInHelper: { src: `float helper(float x) {\n  for (int i = 0; i < 4; i++) { x += 1.; }\n  return x;\n}\nvec3 userMethod(vec2 p, float amount) { return vec3(p, helper(amount)); }`, error: 'の中だけで使えます' },
  discardStatement: { src: wrap('  discard;'), error: 'discard' },
  glPositionWrite: { src: wrap('  gl_Position = vec4(0.);'), error: 'gl_' },
  definePreprocessor: { src: `#define X 1\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: '前処理' },
  uniformDeclaration: { src: `uniform float k;\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: 'uniform' },
  inDeclaration: { src: `in float k;\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: 'in' },
  mainRedefinition: { src: `void main() { }\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`, error: 'main' },
  noEntryPoint: { src: 'float helper(float x) { return x; }', error: 'userMethod' },
  twoEntryPoints: { src: `vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 1.); }`, error: 'userMethod' },
};

// These pass the guard on purpose: the guard is only a text check, the GPU compile and the trial render must catch them.
export const GUARD_PASSES_BUT_COMPILE_FAILS = {
  syntaxError: `vec3 userMethod(vec2 p, float amount) { return vec3(p, 0.) }`,
  undeclaredName: `vec3 userMethod(vec2 p, float amount) {\n  float k = 1.0;\n  return vec3(p, undefinedThing);\n}`,
  clashesWithBuiltIn: `float hash(vec2 p) { return 0.; }\nvec3 userMethod(vec2 p, float amount) { return vec3(p, 0.); }`,
};
