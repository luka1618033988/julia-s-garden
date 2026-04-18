import { FUNCTION_REGISTRY, SYMBOL_REGISTRY, normalizeIdentifier } from "./registries.js";

class FormulaSemanticError extends Error {
  constructor(message, node) {
    const suffix = node?.location ? ` at column ${node.location.column}.` : ".";
    super(`${message}${suffix}`);
    this.name = "FormulaSemanticError";
    this.location = node?.location ?? null;
  }
}

const FAMILY_ORDER = ["polynomial", "rational", "transcendental", "meromorphic", "unsupported"];

function combineFamily(left, right) {
  return FAMILY_ORDER[Math.max(FAMILY_ORDER.indexOf(left), FAMILY_ORDER.indexOf(right))];
}

function isIntegerLiteral(node) {
  return node.type === "Literal" && Number.isInteger(node.value);
}

function isIntegerExponent(node) {
  return isIntegerLiteral(node) || (node.type === "Identifier" && node.symbolKind === "parameter" && (node.name === "degree" || node.name === "n"));
}

function annotate(node) {
  switch (node.type) {
    case "Literal":
      return { ...node, valueType: "complex", family: "polynomial", restrictions: [] };
    case "Identifier": {
      const name = normalizeIdentifier(node.name);
      if (SYMBOL_REGISTRY.variables[name]) {
        return { ...node, name, symbolKind: "variable", valueType: "complex", family: "polynomial", restrictions: [] };
      }
      if (SYMBOL_REGISTRY.constants[name]) {
        return { ...node, name, symbolKind: "constant", valueType: "complex", family: "polynomial", restrictions: [] };
      }
      if (SYMBOL_REGISTRY.parameters[name]) {
        return { ...node, name, symbolKind: "parameter", valueType: "complex", family: "polynomial", restrictions: [] };
      }
      throw new FormulaSemanticError(`Unknown symbol "${node.name}"`, node);
    }
    case "UnaryExpression": {
      const argument = annotate(node.argument);
      return { ...node, argument, valueType: "complex", family: argument.family, restrictions: argument.restrictions };
    }
    case "BinaryExpression": {
      const left = annotate(node.left);
      const right = annotate(node.right);
      const restrictions = [...left.restrictions, ...right.restrictions];
      let family = combineFamily(left.family, right.family);
      if (node.operator === "/") {
        restrictions.push("pole");
        family = family === "polynomial" ? "rational" : combineFamily(family, "meromorphic");
      }
      if (node.operator === "^") {
        if (isIntegerExponent(right) && (!isIntegerLiteral(right) || right.value >= 0)) {
          family = left.family;
        } else if (isIntegerLiteral(right) && right.value < 0) {
          restrictions.push("pole");
          family = "rational";
        } else {
          restrictions.push("branch-point");
          family = "transcendental";
        }
      }
      return { ...node, left, right, valueType: "complex", family, restrictions };
    }
    case "CallExpression": {
      const name = normalizeIdentifier(node.callee);
      const fn = FUNCTION_REGISTRY[name];
      if (!fn) {
        throw new FormulaSemanticError(`Unknown function "${node.callee}"`, node);
      }
      if (node.args.some((arg) => arg.name)) {
        throw new FormulaSemanticError(`Function "${name}" does not accept named parameters yet`, node);
      }
      if (node.args.length !== fn.arity) {
        throw new FormulaSemanticError(`Function "${name}" expects ${fn.arity} argument${fn.arity === 1 ? "" : "s"} but got ${node.args.length}`, node);
      }
      const args = node.args.map((arg) => ({ ...arg, expression: annotate(arg.expression) }));
      const restrictions = args.flatMap((arg) => arg.expression.restrictions).concat(fn.restrictions ?? []);
      const argFamily = args.reduce((family, arg) => combineFamily(family, arg.expression.family), "polynomial");
      const family = name === "pow" && isIntegerExponent(args[1]?.expression)
        ? args[0].expression.family
        : combineFamily(argFamily, fn.family);
      return {
        ...node,
        callee: name,
        args,
        functionInfo: fn,
        valueType: "complex",
        family,
        restrictions: name === "pow" && isIntegerExponent(args[1]?.expression) ? [] : restrictions,
      };
    }
    default:
      throw new FormulaSemanticError(`Unsupported AST node "${node.type}"`, node);
  }
}

function normalize(node) {
  switch (node.type) {
    case "Literal":
      return Number.isInteger(node.value) ? String(node.value) : String(node.value);
    case "Identifier":
      return node.name;
    case "UnaryExpression":
      return `(${node.operator}${normalize(node.argument)})`;
    case "BinaryExpression":
      return `(${normalize(node.left)} ${node.operator} ${normalize(node.right)})`;
    case "CallExpression":
      return `${node.callee}(${node.args.map((arg) => normalize(arg.expression)).join(", ")})`;
    default:
      return "";
  }
}

export function analyzeFormula(ast, source) {
  const annotatedAst = annotate(ast);
  return {
    source,
    ast: annotatedAst,
    family: annotatedAst.family,
    restrictions: [...new Set(annotatedAst.restrictions)],
    normalized: normalize(annotatedAst),
    precisionTiers: ["gpu-fast", "viewport-high", "cpu-reference"],
  };
}
