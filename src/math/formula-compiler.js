import { parseFormula } from "./parser.js";
import { analyzeFormula } from "./semantic.js";
import { generateWgslFormula, createJsEvaluator, createReferenceEvaluator } from "./backends.js";

export function compileFormula(source) {
  const cleaned = String(source ?? "").trim();
  if (!cleaned) {
    throw new Error("Custom formula cannot be empty.");
  }
  const ast = parseFormula(cleaned);
  const analysis = analyzeFormula(ast, cleaned);
  return {
    ...analysis,
    wgsl: generateWgslFormula(analysis),
    evaluate: createJsEvaluator(analysis),
    reference: createReferenceEvaluator(analysis),
  };
}
