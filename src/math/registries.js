export const EVAL_STATES = Object.freeze({
  FINITE: "finite",
  POLE: "pole",
  UNDEFINED: "undefined",
  ESCAPED: "escaped",
  MASKED: "masked",
});

export const PRECISION_TIERS = Object.freeze({
  GPU_FAST: "gpu-fast",
  VIEWPORT_HIGH: "viewport-high",
  CPU_REFERENCE: "cpu-reference",
});

export const SYMBOL_REGISTRY = Object.freeze({
  variables: Object.freeze({
    z: { type: "complex" },
    c: { type: "complex" },
  }),
  parameters: Object.freeze({
    degree: { type: "real", wgsl: "vec2f(f32(degree), 0.0)", defaultValue: 2 },
    n: { type: "real", wgsl: "vec2f(f32(degree), 0.0)", defaultValue: 2, aliasFor: "degree" },
  }),
  constants: Object.freeze({
    pi: { value: { x: Math.PI, y: 0 }, normalized: "pi" },
    e: { value: { x: Math.E, y: 0 }, normalized: "e" },
    phi: { value: { x: (1 + Math.sqrt(5)) / 2, y: 0 }, normalized: "phi" },
    i: { value: { x: 0, y: 1 }, normalized: "i" },
  }),
  aliases: Object.freeze({
    "π": "pi",
  }),
});

export const FUNCTION_REGISTRY = Object.freeze({
  exp: { arity: 1, family: "transcendental", wgsl: "complexExp", js: "exp" },
  log: {
    arity: 1,
    family: "transcendental",
    wgsl: "complexLog",
    js: "log",
    restrictions: ["branch-point"],
  },
  pow: {
    arity: 2,
    family: "transcendental",
    wgsl: "complexPowComplex",
    js: "pow",
    restrictions: ["branch-point"],
  },
  sin: { arity: 1, family: "transcendental", wgsl: "complexSin", js: "sin" },
  cos: { arity: 1, family: "transcendental", wgsl: "complexCos", js: "cos" },
  tan: { arity: 1, family: "meromorphic", wgsl: "complexTan", js: "tan", restrictions: ["pole"] },
  sinh: { arity: 1, family: "transcendental", wgsl: "complexSinh", js: "sinh" },
  cosh: { arity: 1, family: "transcendental", wgsl: "complexCosh", js: "cosh" },
  tanh: { arity: 1, family: "meromorphic", wgsl: "complexTanh", js: "tanh", restrictions: ["pole"] },
  sqrt: {
    arity: 1,
    family: "transcendental",
    wgsl: "complexSqrt",
    js: "sqrt",
    restrictions: ["branch-point"],
  },
  abs: { arity: 1, family: "transcendental", wgsl: "complexAbs", js: "abs" },
  arg: {
    arity: 1,
    family: "transcendental",
    wgsl: "complexArg",
    js: "arg",
    restrictions: ["branch-point"],
  },
  conj: { arity: 1, family: "polynomial", wgsl: "complexConj", js: "conj" },
  re: { arity: 1, family: "polynomial", wgsl: "complexRe", js: "re" },
  im: { arity: 1, family: "polynomial", wgsl: "complexIm", js: "im" },
});

export function normalizeIdentifier(name) {
  const normalized = String(name ?? "").toLowerCase();
  return SYMBOL_REGISTRY.aliases[normalized] ?? normalized;
}
