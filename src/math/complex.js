import { EVAL_STATES, SYMBOL_REGISTRY } from "./registries.js";

const EPSILON = 0;

export class ComplexValue {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static from(value) {
    if (value instanceof ComplexValue) return value;
    if (typeof value === "number") return new ComplexValue(value, 0);
    return new ComplexValue(value?.x ?? 0, value?.y ?? 0);
  }
}

export function finite(value) {
  const complex = ComplexValue.from(value);
  if (!Number.isFinite(complex.x) || !Number.isFinite(complex.y)) {
    return { state: EVAL_STATES.UNDEFINED, value: complex };
  }
  return { state: EVAL_STATES.FINITE, value: complex };
}

export function pole(value = new ComplexValue(Infinity, Infinity)) {
  return { state: EVAL_STATES.POLE, value: ComplexValue.from(value) };
}

export function undefinedValue(value = new ComplexValue(NaN, NaN)) {
  return { state: EVAL_STATES.UNDEFINED, value: ComplexValue.from(value) };
}

function add(a, b) {
  return new ComplexValue(a.x + b.x, a.y + b.y);
}

function sub(a, b) {
  return new ComplexValue(a.x - b.x, a.y - b.y);
}

function neg(a) {
  return new ComplexValue(-a.x, -a.y);
}

function mul(a, b) {
  return new ComplexValue(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

function div(a, b) {
  const denom = b.x * b.x + b.y * b.y;
  if (denom === EPSILON) return pole();
  return new ComplexValue((a.x * b.x + a.y * b.y) / denom, (a.y * b.x - a.x * b.y) / denom);
}

function exp(a) {
  const scale = Math.exp(a.x);
  return new ComplexValue(scale * Math.cos(a.y), scale * Math.sin(a.y));
}

function log(a) {
  const magnitude2 = a.x * a.x + a.y * a.y;
  if (magnitude2 === 0) return pole(new ComplexValue(-Infinity, 0));
  return new ComplexValue(0.5 * Math.log(magnitude2), Math.atan2(a.y, a.x));
}

function pow(a, b) {
  if (b.y === 0 && Number.isInteger(b.x) && b.x >= 0) {
    return powInt(a, b.x);
  }
  const logged = log(a);
  if (logged.state) return logged;
  return exp(mul(b, logged));
}

function powInt(a, degree) {
  let result = new ComplexValue(1, 0);
  for (let i = 0; i < Math.max(0, degree); i += 1) {
    result = mul(result, a);
  }
  return result;
}

function sin(a) {
  return new ComplexValue(Math.sin(a.x) * Math.cosh(a.y), Math.cos(a.x) * Math.sinh(a.y));
}

function cos(a) {
  return new ComplexValue(Math.cos(a.x) * Math.cosh(a.y), -Math.sin(a.x) * Math.sinh(a.y));
}

function sqrt(a) {
  const r = Math.hypot(a.x, a.y);
  const real = Math.sqrt(Math.max((r + a.x) / 2, 0));
  const imag = Math.sign(a.y || 1) * Math.sqrt(Math.max((r - a.x) / 2, 0));
  return new ComplexValue(real, imag);
}

export const COMPLEX_RUNTIME = Object.freeze({
  add,
  sub,
  neg,
  mul,
  div,
  exp,
  log,
  pow,
  powInt,
  sin,
  cos,
  tan: (a) => div(sin(a), cos(a)),
  sinh: (a) => new ComplexValue(Math.sinh(a.x) * Math.cos(a.y), Math.cosh(a.x) * Math.sin(a.y)),
  cosh: (a) => new ComplexValue(Math.cosh(a.x) * Math.cos(a.y), Math.sinh(a.x) * Math.sin(a.y)),
  tanh: (a) => div(COMPLEX_RUNTIME.sinh(a), COMPLEX_RUNTIME.cosh(a)),
  sqrt,
  abs: (a) => new ComplexValue(Math.hypot(a.x, a.y), 0),
  arg: (a) => new ComplexValue(Math.atan2(a.y, a.x), 0),
  conj: (a) => new ComplexValue(a.x, -a.y),
  re: (a) => new ComplexValue(a.x, 0),
  im: (a) => new ComplexValue(a.y, 0),
});

export function constantValue(name) {
  return new ComplexValue(SYMBOL_REGISTRY.constants[name].value.x, SYMBOL_REGISTRY.constants[name].value.y);
}
