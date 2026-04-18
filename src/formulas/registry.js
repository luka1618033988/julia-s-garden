import { compileFormula } from "../math/formula-compiler.js";

export const FORMULAS = [
  {
    id: "power",
    name: "z^n + c",
    family: "polynomial",
    description: "General z^n + c family with an integer degree.",
    defaultParams: { degree: 2 },
    adjustableParams: [
      { id: "degree", label: "Degree", min: 2, max: 8, step: 1 },
    ],
    snippet: `
fn iterateFormula(z: vec2f, c: vec2f, degree: i32) -> vec2f {
  return complexPow(z, max(degree, 2)) + c;
}
`,
  },
  {
    id: "sine",
    name: "sin(z) + c",
    family: "transcendental",
    description: "Transcendental example using sin(z) + c.",
    parameterPlaneMode: "custom-seeded",
    defaultParams: { degree: 2 },
    adjustableParams: [],
    snippet: `
fn iterateFormula(z: vec2f, c: vec2f, degree: i32) -> vec2f {
  return complexSin(z) + c;
}
`,
  },
  {
    id: "c-sine",
    name: "c*sin(z)",
    family: "transcendental",
    description: "Transcendental example using c*sin(z).",
    parameterPlaneMode: "custom-seeded",
    defaultParams: { degree: 2 },
    adjustableParams: [],
    snippet: `
fn iterateFormula(z: vec2f, c: vec2f, degree: i32) -> vec2f {
  return complexMul(c, complexSin(z));
}
`,
  },
  {
    id: "custom",
    name: "Custom",
    family: "custom",
    description: "User-defined complex formula.",
    defaultParams: { degree: 2 },
    adjustableParams: [],
    snippet: `
fn iterateFormula(z: vec2f, c: vec2f, degree: i32) -> vec2f {
  return complexAdd(complexMul(z, z), c);
}
`,
  },
];

export function getFormulaById(id) {
  return FORMULAS.find((formula) => formula.id === id) ?? FORMULAS[0];
}

export function createCustomFormula(expression) {
  const cleaned = (expression || "").trim();
  if (!cleaned) {
    return getFormulaById("custom");
  }
  const compiled = compileFormula(cleaned);
  return {
    id: "custom",
    name: "Custom",
    family: compiled.family,
    parameterPlaneMode: "custom-seeded",
    description: `${compiled.normalized} (${compiled.family})`,
    defaultParams: { degree: 2 },
    adjustableParams: [],
    snippet: compiled.wgsl,
    math: compiled,
  };
}
