import { COMPLEX_RUNTIME, ComplexValue, constantValue, finite, pole, undefinedValue } from "./complex.js";
import { EVAL_STATES, FUNCTION_REGISTRY, SYMBOL_REGISTRY } from "./registries.js";

const WGSL_BINARY = {
  "+": "complexAdd",
  "-": "complexSub",
  "*": "complexMul",
  "/": "complexDiv",
};

function wgslFloat(value) {
  if (Number.isInteger(value)) return `${value}.0`;
  return Number(value).toPrecision(10);
}

function integerLiteral(node) {
  return node.type === "Literal" && Number.isInteger(node.value) ? node.value : null;
}

function integerExponentExpression(node) {
  const literal = integerLiteral(node);
  if (literal !== null) return String(literal);
  if (node.type === "Identifier" && node.symbolKind === "parameter" && (node.name === "degree" || node.name === "n")) {
    return "degree";
  }
  return null;
}

export function generateWgslExpression(node) {
  switch (node.type) {
    case "Literal":
      return `vec2f(${wgslFloat(node.value)}, 0.0)`;
    case "Identifier":
      if (node.symbolKind === "constant") {
        const value = constantValue(node.name);
        return `vec2f(${wgslFloat(value.x)}, ${wgslFloat(value.y)})`;
      }
      if (node.symbolKind === "parameter") {
        return SYMBOL_REGISTRY.parameters[node.name].wgsl;
      }
      return node.name;
    case "UnaryExpression": {
      const arg = generateWgslExpression(node.argument);
      return node.operator === "-" ? `complexNeg(${arg})` : arg;
    }
    case "BinaryExpression": {
      const left = generateWgslExpression(node.left);
      const right = generateWgslExpression(node.right);
      if (node.operator === "^") {
        const exponent = integerExponentExpression(node.right);
        if (exponent !== null && (exponent === "degree" || (Number(exponent) >= 0 && Number(exponent) <= 32))) {
          return `complexPow(${left}, ${exponent})`;
        }
        return `complexPowComplex(${left}, ${right})`;
      }
      return `${WGSL_BINARY[node.operator]}(${left}, ${right})`;
    }
    case "CallExpression": {
      const fn = FUNCTION_REGISTRY[node.callee];
      const args = node.args.map((arg) => generateWgslExpression(arg.expression)).join(", ");
      return `${fn.wgsl}(${args})`;
    }
    default:
      throw new Error(`Cannot generate WGSL for "${node.type}".`);
  }
}

export function generateWgslFormula(analysis) {
  const expression = generateWgslExpression(analysis.ast);
  return `
fn iterateFormula(z: vec2f, c: vec2f, degree: i32) -> vec2f {
  return ${expression};
}
`;
}

function mergeState(left, right) {
  if (left.state !== EVAL_STATES.FINITE) return left;
  if (right.state !== EVAL_STATES.FINITE) return right;
  return null;
}

function evaluateNode(node, scope) {
  switch (node.type) {
    case "Literal":
      return finite(new ComplexValue(node.value, 0));
    case "Identifier":
      if (node.symbolKind === "constant") return finite(constantValue(node.name));
      if (node.symbolKind === "parameter") {
        const parameter = SYMBOL_REGISTRY.parameters[node.name];
        return finite(new ComplexValue(Number(scope[node.name] ?? scope[parameter.aliasFor] ?? parameter.defaultValue), 0));
      }
      if (!(node.name in scope)) return undefinedValue();
      return finite(scope[node.name]);
    case "UnaryExpression": {
      const arg = evaluateNode(node.argument, scope);
      if (arg.state !== EVAL_STATES.FINITE) return arg;
      return finite(node.operator === "-" ? COMPLEX_RUNTIME.neg(arg.value) : arg.value);
    }
    case "BinaryExpression": {
      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);
      const existing = mergeState(left, right);
      if (existing) return existing;
      if (node.operator === "+") return finite(COMPLEX_RUNTIME.add(left.value, right.value));
      if (node.operator === "-") return finite(COMPLEX_RUNTIME.sub(left.value, right.value));
      if (node.operator === "*") return finite(COMPLEX_RUNTIME.mul(left.value, right.value));
      if (node.operator === "/") {
        const value = COMPLEX_RUNTIME.div(left.value, right.value);
        return value.state ? value : finite(value);
      }
      if (node.operator === "^") {
        const exponent = integerExponentExpression(node.right);
        if (exponent !== null) {
          const degree = exponent === "degree"
            ? Number(scope.degree ?? scope.n ?? 2)
            : Number(exponent);
          if (Number.isInteger(degree) && degree >= 0) {
            return finite(COMPLEX_RUNTIME.powInt(left.value, degree));
          }
        }
        const value = COMPLEX_RUNTIME.pow(left.value, right.value);
        return value.state ? value : finite(value);
      }
      return undefinedValue();
    }
    case "CallExpression": {
      const values = [];
      for (const arg of node.args) {
        const evaluated = evaluateNode(arg.expression, scope);
        if (evaluated.state !== EVAL_STATES.FINITE) return evaluated;
        values.push(evaluated.value);
      }
      const fn = COMPLEX_RUNTIME[node.functionInfo.js];
      if (!fn) return undefinedValue();
      const value = fn(...values);
      return value.state ? value : finite(value);
    }
    default:
      return undefinedValue();
  }
}

export function createJsEvaluator(analysis) {
  return function evaluate(scope = {}) {
    return evaluateNode(analysis.ast, {
      z: ComplexValue.from(scope.z ?? { x: 0, y: 0 }),
      c: ComplexValue.from(scope.c ?? { x: 0, y: 0 }),
    });
  };
}

export function createReferenceEvaluator(analysis, options = {}) {
  const evaluator = createJsEvaluator(analysis);
  return {
    precision: options.precision ?? "cpu-reference",
    evaluate: evaluator,
  };
}
