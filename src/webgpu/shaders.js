function buildFormulaLibrary(formula) {
  return `
fn complexMul(a: vec2f, b: vec2f) -> vec2f {
  return vec2f(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

fn complexAdd(a: vec2f, b: vec2f) -> vec2f {
  return a + b;
}

fn complexSub(a: vec2f, b: vec2f) -> vec2f {
  return a - b;
}

fn complexNeg(a: vec2f) -> vec2f {
  return -a;
}

fn complexDiv(a: vec2f, b: vec2f) -> vec2f {
  let denom = dot(b, b);
  return vec2f(
    (a.x * b.x + a.y * b.y) / denom,
    (a.y * b.x - a.x * b.y) / denom
  );
}

fn complexPow(base: vec2f, degree: i32) -> vec2f {
  var result = vec2f(1.0, 0.0);
  var i = 0;
  loop {
    if (i >= degree) {
      break;
    }
    result = complexMul(result, base);
    i = i + 1;
  }
  return result;
}

fn complexLog(z: vec2f) -> vec2f {
  let magnitude2 = dot(z, z);
  return vec2f(0.5 * log(magnitude2), atan2(z.y, z.x));
}

fn complexPowComplex(base: vec2f, exponent: vec2f) -> vec2f {
  return complexExp(complexMul(exponent, complexLog(base)));
}

fn complexSin(z: vec2f) -> vec2f {
  let ex = exp(z.y);
  let enx = exp(-z.y);
  let sinhY = 0.5 * (ex - enx);
  let coshY = 0.5 * (ex + enx);
  return vec2f(sin(z.x) * coshY, cos(z.x) * sinhY);
}

fn complexCos(z: vec2f) -> vec2f {
  let ex = exp(z.y);
  let enx = exp(-z.y);
  let sinhY = 0.5 * (ex - enx);
  let coshY = 0.5 * (ex + enx);
  return vec2f(cos(z.x) * coshY, -sin(z.x) * sinhY);
}

fn complexExp(z: vec2f) -> vec2f {
  let scale = exp(z.x);
  return vec2f(scale * cos(z.y), scale * sin(z.y));
}

fn complexTan(z: vec2f) -> vec2f {
  return complexDiv(complexSin(z), complexCos(z));
}

fn complexSinh(z: vec2f) -> vec2f {
  let ex = exp(z.x);
  let enx = exp(-z.x);
  let sinhX = 0.5 * (ex - enx);
  let coshX = 0.5 * (ex + enx);
  return vec2f(sinhX * cos(z.y), coshX * sin(z.y));
}

fn complexCosh(z: vec2f) -> vec2f {
  let ex = exp(z.x);
  let enx = exp(-z.x);
  let sinhX = 0.5 * (ex - enx);
  let coshX = 0.5 * (ex + enx);
  return vec2f(coshX * cos(z.y), sinhX * sin(z.y));
}

fn complexTanh(z: vec2f) -> vec2f {
  return complexDiv(complexSinh(z), complexCosh(z));
}

fn complexSqrt(z: vec2f) -> vec2f {
  let magnitude = length(z);
  let real = sqrt(max((magnitude + z.x) * 0.5, 0.0));
  let signY = select(-1.0, 1.0, z.y >= 0.0);
  let imag = signY * sqrt(max((magnitude - z.x) * 0.5, 0.0));
  return vec2f(real, imag);
}

fn complexAbs(z: vec2f) -> vec2f {
  return vec2f(length(z), 0.0);
}

fn complexArg(z: vec2f) -> vec2f {
  return vec2f(atan2(z.y, z.x), 0.0);
}

fn complexConj(z: vec2f) -> vec2f {
  return vec2f(z.x, -z.y);
}

fn complexRe(z: vec2f) -> vec2f {
  return vec2f(z.x, 0.0);
}

fn complexIm(z: vec2f) -> vec2f {
  return vec2f(z.y, 0.0);
}

${formula.snippet}
`;
}

export function buildFractalShader(formula) {
  const parameterMode = formula.parameterPlaneMode ?? "classic";
  return `
struct RenderUniforms {
  centerHi: vec2f,
  centerLo: vec2f,
  selectedCHi: vec2f,
  selectedCLo: vec2f,
  customSeedHi: vec2f,
  customSeedLo: vec2f,
  canvasSize: vec2f,
  span: vec2f,
  settings: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: RenderUniforms;

${buildFormulaLibrary(formula)}

fn paletteColor(t: f32, palette: i32) -> vec3f {
  if (palette == 1) {
    return vec3f(0.5) + vec3f(0.5) * cos(6.28318 * (vec3f(0.15, 0.35, 0.65) + vec3f(t)));
  }
  if (palette == 2) {
    return vec3f(0.55) + vec3f(0.45) * cos(6.28318 * (vec3f(0.00, 0.12, 0.32) + vec3f(t * 0.8, t * 1.05, t * 1.2)));
  }
  if (palette == 3) {
    return vec3f(0.42) + vec3f(0.38) * cos(6.28318 * (vec3f(0.20, 0.33, 0.48) + vec3f(t * 0.72, t, t * 1.28)));
  }
  if (palette == 4) {
    return vec3f(0.50) + vec3f(0.46) * cos(6.28318 * (vec3f(0.94, 0.18, 0.05) + vec3f(t * 0.65, t * 0.95, t * 1.4)));
  }
  if (palette == 5) {
    let gray = 0.15 + 0.82 * t;
    return vec3f(gray);
  }
  if (palette == 6) {
    return vec3f(0.52) + vec3f(0.44) * cos(6.28318 * (vec3f(0.58, 0.09, 0.31) + vec3f(t * 0.55, t * 1.1, t * 0.82)));
  }
  return vec3f(0.5) + vec3f(0.5) * cos(6.28318 * (vec3f(0.05, 0.18, 0.31) + vec3f(t)));
}

fn preciseAdd(hi: f32, lo: f32, delta: f32) -> f32 {
  let t = hi + delta;
  let e = ((hi - t) + delta) + lo;
  return t + e;
}

fn initialState(point: vec2f, selectedC: vec2f, customSeed: vec2f, sceneType: i32) -> vec4f {
  if (sceneType == 0) {
    if (${parameterMode === "self-seeded" ? "true" : "false"}) {
      return vec4f(point.x, point.y, point.x, point.y);
    }
    if (${parameterMode === "custom-seeded" ? "true" : "false"}) {
      return vec4f(customSeed.x, customSeed.y, point.x, point.y);
    }
    return vec4f(0.0, 0.0, point.x, point.y);
  }
  return vec4f(point.x, point.y, selectedC.x, selectedC.y);
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  let position = positions[vertexIndex];
  return vec4f(position, 0.0, 1.0);
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / uniforms.canvasSize;
  let aspect = uniforms.canvasSize.x / max(uniforms.canvasSize.y, 1.0);
  let spanXHi = uniforms.span.x * aspect;
  let spanXLo = uniforms.span.y * aspect;
  let point = vec2f(
    preciseAdd(uniforms.centerHi.x, uniforms.centerLo.x, (uv.x - 0.5) * spanXHi + (uv.x - 0.5) * spanXLo),
    preciseAdd(uniforms.centerHi.y, uniforms.centerLo.y, -(uv.y - 0.5) * uniforms.span.x - (uv.y - 0.5) * uniforms.span.y)
  );

  let maxIterations = i32(uniforms.settings.x);
  let degree = i32(uniforms.settings.y);
  let sceneType = i32(uniforms.settings.z);
  let palette = i32(uniforms.settings.w);
  let selectedC = vec2f(
    preciseAdd(uniforms.selectedCHi.x, uniforms.selectedCLo.x, 0.0),
    preciseAdd(uniforms.selectedCHi.y, uniforms.selectedCLo.y, 0.0)
  );
  let customSeed = vec2f(
    preciseAdd(uniforms.customSeedHi.x, uniforms.customSeedLo.x, 0.0),
    preciseAdd(uniforms.customSeedHi.y, uniforms.customSeedLo.y, 0.0)
  );
  var state = initialState(point, selectedC, customSeed, sceneType);
  var z = state.xy;
  let c = state.zw;

  var escapedAt = maxIterations;
  var smoothValue = 0.0;
  var i = 0;
  loop {
    if (i >= maxIterations) {
      break;
    }
    z = iterateFormula(z, c, degree);
    let magnitude2 = dot(z, z);
    if (magnitude2 > 256.0) {
      escapedAt = i;
      smoothValue = f32(i) + 1.0 - log2(log2(max(magnitude2, 1.0001)));
      break;
    }
    i = i + 1;
  }

  if (escapedAt == maxIterations) {
    return vec4f(0.015, 0.018, 0.03, 1.0);
  }

  let t = clamp(smoothValue / max(uniforms.settings.x, 1.0), 0.0, 1.0);
  let color = paletteColor(t, palette);
  return vec4f(color, 1.0);
}
`;
}
