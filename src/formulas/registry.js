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

function tokenize(expression) {
  const matches = expression.match(/\s*([A-Za-z_]+|\d*\.?\d+|[()+\-*/^,])\s*/g) ?? [];
  const tokens = matches.map((token) => token.trim()).filter(Boolean);
  if (tokens.join("") !== expression.replace(/\s+/g, "")) {
    throw new Error("Unsupported character in custom formula.");
  }
  return tokens;
}

function constantLiteral(name) {
  if (name === "pi") return `vec2f(${Math.PI.toFixed(8)}, 0.0)`;
  if (name === "e") return `vec2f(${Math.E.toFixed(8)}, 0.0)`;
  if (name === "phi") return `vec2f(${((1 + Math.sqrt(5)) / 2).toFixed(8)}, 0.0)`;
  return null;
}

function parseExpression(tokens) {
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume(expected) {
    const token = tokens[index];
    if (expected && token !== expected) {
      throw new Error(`Expected "${expected}" in custom formula.`);
    }
    index += 1;
    return token;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) {
      throw new Error("Unexpected end of custom formula.");
    }
    if (token === "(") {
      consume("(");
      const expr = parseAddSub();
      consume(")");
      return expr;
    }
    if (token === "-") {
      consume("-");
      return `complexNeg(${parsePrimary()})`;
    }
    if (/^\d*\.?\d+$/.test(token)) {
      consume();
      return `vec2f(${Number(token).toFixed(8)}, 0.0)`;
    }
    const constant = constantLiteral(token.toLowerCase());
    if (constant) {
      consume();
      return constant;
    }
    if (token === "z" || token === "c") {
      consume();
      return token;
    }
    if (["sin", "cos", "exp"].includes(token)) {
      const fn = consume();
      consume("(");
      const arg = parseAddSub();
      consume(")");
      const map = {
        sin: "complexSin",
        cos: "complexCos",
        exp: "complexExp",
      };
      return `${map[fn]}(${arg})`;
    }
    throw new Error(`Unsupported token "${token}" in custom formula.`);
  }

  function parsePow() {
    let left = parsePrimary();
    while (peek() === "^") {
      consume("^");
      const right = parsePrimary();
      const match = right.match(/^vec2f\(([-\d.]+), 0\.0\)$/);
      if (match) {
        const exponent = Number(match[1]);
        if (Number.isInteger(exponent) && exponent >= 0 && exponent <= 16) {
          left = `complexPow(${left}, ${exponent})`;
          continue;
        }
      }
      left = `complexPowComplex(${left}, ${right})`;
    }
    return left;
  }

  function parseMulDiv() {
    let left = parsePow();
    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = parsePow();
      left =
        operator === "*"
          ? `complexMul(${left}, ${right})`
          : `complexDiv(${left}, ${right})`;
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseMulDiv();
      left =
        operator === "+"
          ? `complexAdd(${left}, ${right})`
          : `complexSub(${left}, ${right})`;
    }
    return left;
  }

  const parsed = parseAddSub();
  if (index !== tokens.length) {
    throw new Error("Could not parse full custom formula.");
  }
  return parsed;
}

export function createCustomFormula(expression) {
  const cleaned = (expression || "").trim();
  if (!cleaned) {
    return getFormulaById("custom");
  }
  const compiled = parseExpression(tokenize(cleaned));
  return {
    id: "custom",
    name: "Custom",
    family: "custom",
    parameterPlaneMode: "custom-seeded",
    description: cleaned,
    defaultParams: { degree: 2 },
    adjustableParams: [],
    snippet: `
fn iterateFormula(z: vec2f, c: vec2f, degree: i32) -> vec2f {
  return ${compiled};
}
`,
  };
}
