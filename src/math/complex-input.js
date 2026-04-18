const NUMBER_PATTERN = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?";
const NUMBER_RE = new RegExp(`^${NUMBER_PATTERN}$`, "i");
const SCALAR_PATTERN = `[+-]?(?:(?:${NUMBER_PATTERN})|pi|π|e|phi)`;
const PAIR_RE = new RegExp(`^\\(\\s*(${SCALAR_PATTERN})\\s*,\\s*(${SCALAR_PATTERN})\\s*\\)$`, "iu");

const CONSTANTS = {
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  pi: Math.PI,
  "π": Math.PI,
};

function parseFiniteNumber(value, label) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    throw new Error(`Enter an ${label} value.`);
  }
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^[+-]/, "");
  if (unsigned in CONSTANTS) {
    return sign * CONSTANTS[unsigned];
  }
  if (!NUMBER_RE.test(normalized)) {
    throw new Error(`Invalid ${label} value.`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label} value.`);
  }
  return parsed;
}

export function parseComplexParts(realInput, imaginaryInput) {
  return {
    x: parseFiniteNumber(realInput, "real"),
    y: parseFiniteNumber(imaginaryInput, "imaginary"),
  };
}

function parseImaginaryCoefficient(value) {
  if (value === "" || value === "+") return 1;
  if (value === "-") return -1;
  return parseFiniteNumber(value, "imaginary");
}

export function parseComplexCoordinate(input) {
  const raw = String(input ?? "").trim();
  if (!raw) {
    throw new Error("Enter a complex coordinate.");
  }

  const pair = PAIR_RE.exec(raw);
  if (pair) {
    return {
      x: parseFiniteNumber(pair[1], "real"),
      y: parseFiniteNumber(pair[2], "imaginary"),
    };
  }

  const value = raw.replace(/\s+/g, "");
  try {
    return {
      x: parseFiniteNumber(value, "real"),
      y: 0,
    };
  } catch {
    // Keep going; values like "2i" and "1+2i" are complex forms.
  }

  if (value.endsWith("i")) {
    const withoutI = value.slice(0, -1);
    for (let separator = withoutI.length - 1; separator > 0; separator -= 1) {
      if (withoutI[separator] !== "+" && withoutI[separator] !== "-") continue;
      try {
        return {
          x: parseFiniteNumber(withoutI.slice(0, separator), "real"),
          y: parseImaginaryCoefficient(withoutI.slice(separator)),
        };
      } catch {
        // Try the next sign; this may have been part of scientific notation.
      }
    }
    return {
      x: 0,
      y: parseImaginaryCoefficient(withoutI),
    };
  }

  throw new Error("Invalid real value.");
}
