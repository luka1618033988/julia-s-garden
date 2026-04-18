class FormulaSyntaxError extends Error {
  constructor(message, location) {
    super(`${message} at column ${location.column}.`);
    this.name = "FormulaSyntaxError";
    this.location = location;
  }
}

const TOKEN_PATTERNS = [
  ["number", /^(?:\d+\.\d*|\.\d+|\d+)(?:e[+-]?\d+)?/i],
  ["identifier", /^[A-Za-z_π][A-Za-z0-9_π]*/u],
  ["operator", /^[+\-*/^=]/],
  ["punctuation", /^[(),]/],
];

function locationAt(index) {
  return { index, column: index + 1 };
}

export function tokenizeFormula(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }

    let matched = null;
    for (const [type, pattern] of TOKEN_PATTERNS) {
      const match = pattern.exec(rest);
      if (match) {
        matched = { type, value: match[0], location: locationAt(index) };
        break;
      }
    }
    if (!matched) {
      throw new FormulaSyntaxError(`Unsupported character "${source[index]}"`, locationAt(index));
    }
    tokens.push(matched);
    index += matched.value.length;
  }
  tokens.push({ type: "eof", value: "", location: locationAt(index) });
  return tokens;
}

export function parseFormula(source) {
  const tokens = tokenizeFormula(source);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume(value = null) {
    const token = peek();
    if (value !== null && token.value !== value) {
      throw new FormulaSyntaxError(`Expected "${value}"`, token.location);
    }
    index += 1;
    return token;
  }

  function parseExpression() {
    return parseAddSub();
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek().value === "+" || peek().value === "-") {
      const operator = consume().value;
      left = {
        type: "BinaryExpression",
        operator,
        left,
        right: parseMulDiv(),
        location: left.location,
      };
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (peek().value === "*" || peek().value === "/") {
      const operator = consume().value;
      left = {
        type: "BinaryExpression",
        operator,
        left,
        right: parseUnary(),
        location: left.location,
      };
    }
    return left;
  }

  function parsePower() {
    const left = parsePrimary();
    if (peek().value !== "^") {
      return left;
    }
    const operator = consume().value;
    return {
      type: "BinaryExpression",
      operator,
      left,
      right: parseUnary(),
      location: left.location,
    };
  }

  function parseUnary() {
    if (peek().value === "+" || peek().value === "-") {
      const token = consume();
      return {
        type: "UnaryExpression",
        operator: token.value,
        argument: parseUnary(),
        location: token.location,
      };
    }
    return parsePower();
  }

  function parsePrimary() {
    const token = peek();
    if (token.type === "number") {
      consume();
      return {
        type: "Literal",
        value: Number(token.value),
        raw: token.value,
        location: token.location,
      };
    }
    if (token.type === "identifier") {
      const identifier = consume();
      if (peek().value !== "(") {
        return {
          type: "Identifier",
          name: identifier.value,
          location: identifier.location,
        };
      }
      consume("(");
      const args = [];
      if (peek().value !== ")") {
        do {
          const start = peek();
          let name = null;
          if (start.type === "identifier" && tokens[index + 1]?.value === "=") {
            name = consume().value;
            consume("=");
          }
          args.push({ name, expression: parseExpression(), location: start.location });
          if (peek().value !== ",") {
            break;
          }
          consume(",");
        } while (peek().value !== ")");
      }
      consume(")");
      return {
        type: "CallExpression",
        callee: identifier.value,
        args,
        location: identifier.location,
      };
    }
    if (token.value === "(") {
      consume("(");
      const expression = parseExpression();
      consume(")");
      return expression;
    }
    if (token.type === "eof") {
      throw new FormulaSyntaxError("Unexpected end of formula", token.location);
    }
    throw new FormulaSyntaxError(`Unexpected token "${token.value}"`, token.location);
  }

  const expression = parseExpression();
  if (peek().type !== "eof") {
    throw new FormulaSyntaxError(`Unexpected token "${peek().value}"`, peek().location);
  }
  return expression;
}
