import { initializeWebGpu } from "../webgpu/context.js";
import { buildFractalShader } from "../webgpu/shaders.js";

const PALETTE_INDEX = {
  nebula: 0,
  sunset: 1,
  ice: 2,
  forest: 3,
  ember: 4,
  mono: 5,
  aurora: 6,
};

const QUALITY_SCALE = {
  crisp: { interactive: 1, settled: 1 },
  balanced: { interactive: 0.8, settled: 1 },
  fast: { interactive: 0.55, settled: 0.9 },
};

function createUniformBuffer(device) {
  return device.createBuffer({
    size: 4 * 24,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function splitDouble(value) {
  const hi = Math.fround(value);
  return { hi, lo: value - hi };
}

export class FractalRenderer {
  constructor({ canvas, sceneType, label }) {
    this.canvas = canvas;
    this.sceneType = sceneType;
    this.label = label;
    this.viewport = { centerX: 0, centerY: 0, spanY: 2.8 };
    this.selectedC = { x: 0, y: 0 };
    this.renderSettings = { maxIterations: 180, palette: "nebula", qualityMode: "balanced" };
    this.formula = null;
    this.formulaParams = { degree: 2 };
    this.customSeed = { x: 0, y: 0 };
    this.gpu = null;
    this.pipeline = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
  }

  async initialize(formula) {
    this.gpu = await initializeWebGpu(this.canvas);
    this.uniformBuffer = createUniformBuffer(this.gpu.device);
    this.gpu.context.configure({
      device: this.gpu.device,
      format: this.gpu.format,
      alphaMode: "opaque",
    });
    await this.setFormula(formula, this.formulaParams);
  }

  async setFormula(formula, formulaParams = this.formulaParams) {
    if (!this.gpu) return;
    this.formula = formula;
    this.formulaParams = { ...this.formulaParams, ...formulaParams };
    const shaderModule = this.gpu.device.createShaderModule({
      label: `${this.label}-shader`,
      code: buildFractalShader(formula),
    });
    const compilationInfo = await shaderModule.getCompilationInfo();
    const errors = compilationInfo.messages.filter(
      (message) => message.type === "error",
    );
    if (errors.length) {
      throw new Error(
        `Shader compilation failed for ${this.label}:\n${errors
          .map((message) => message.message)
          .join("\n")}`,
      );
    }

    this.pipeline = await this.gpu.device.createRenderPipelineAsync({
      label: `${this.label}-pipeline`,
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vertexMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this.gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    this.bindGroup = this.gpu.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
    this.render();
  }

  resize(width, height, interacting = false) {
    const quality = QUALITY_SCALE[this.renderSettings.qualityMode] ?? QUALITY_SCALE.balanced;
    const scale = interacting ? quality.interactive : quality.settled;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.max(1, Math.round(width * pixelRatio * scale));
    const targetHeight = Math.max(1, Math.round(height * pixelRatio * scale));
    if (this.canvas.width === targetWidth && this.canvas.height === targetHeight) return;
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
  }

  setViewport(viewport) {
    this.viewport = viewport;
  }

  setSelectedC(selectedC) {
    this.selectedC = selectedC;
  }

  setRenderSettings(renderSettings, formulaParams = this.formulaParams, customSeed = this.customSeed) {
    this.renderSettings = { ...this.renderSettings, ...renderSettings };
    this.formulaParams = { ...this.formulaParams, ...formulaParams };
    this.customSeed = { ...this.customSeed, ...customSeed };
  }

  render() {
    if (!this.pipeline || !this.gpu) return;
    const { device, context } = this.gpu;
    const adaptiveIterations = Math.min(
      4000,
      Math.max(
        Number(this.renderSettings.maxIterations),
        Math.round(
          Number(this.renderSettings.maxIterations) +
            Math.max(0, Math.log10(2.8 / Math.max(this.viewport.spanY, Number.EPSILON)) * 110),
        ),
      ),
    );
    const centerX = splitDouble(this.viewport.centerX);
    const centerY = splitDouble(this.viewport.centerY);
    const selectedCX = splitDouble(this.selectedC.x);
    const selectedCY = splitDouble(this.selectedC.y);
    const customSeedX = splitDouble(this.customSeed.x);
    const customSeedY = splitDouble(this.customSeed.y);
    const spanY = splitDouble(this.viewport.spanY);
    const data = new Float32Array([
      centerX.hi,
      centerY.hi,
      centerX.lo,
      centerY.lo,
      selectedCX.hi,
      selectedCY.hi,
      selectedCX.lo,
      selectedCY.lo,
      customSeedX.hi,
      customSeedY.hi,
      customSeedX.lo,
      customSeedY.lo,
      this.canvas.width,
      this.canvas.height,
      spanY.hi,
      spanY.lo,
      adaptiveIterations,
      Number(this.formulaParams.degree ?? 2),
      this.sceneType === "mandelbrot" ? 0 : 1,
      Number(PALETTE_INDEX[this.renderSettings.palette] ?? 0),
    ]);
    device.queue.writeBuffer(this.uniformBuffer, 0, data);

    try {
      const encoder = device.createCommandEncoder({ label: `${this.label}-encoder` });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.01, g: 0.01, b: 0.02, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(6);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } catch (error) {
      throw new Error(
        `WebGPU render failed for ${this.label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async exportImage({ width = 4096, height = 4096, formula, viewport, selectedC, formulaParams, renderSettings, customSeed }) {
    const previousWidth = this.canvas.width;
    const previousHeight = this.canvas.height;
    const previousFormula = this.formula;
    const previousViewport = this.viewport;
    const previousSelectedC = this.selectedC;
    const previousFormulaParams = this.formulaParams;
    const previousRenderSettings = this.renderSettings;
    const previousCustomSeed = this.customSeed;

    await this.setFormula(formula, formulaParams);
    this.setViewport(viewport);
    this.setSelectedC(selectedC);
    this.setRenderSettings(
      { ...renderSettings, qualityMode: "crisp" },
      formulaParams,
      customSeed,
    );
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
    await this.gpu.device.queue.onSubmittedWorkDone();

    const blob = await new Promise((resolve, reject) => {
      this.canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob);
        else reject(new Error("Could not create export image."));
      }, "image/png");
    });

    this.canvas.width = previousWidth;
    this.canvas.height = previousHeight;
    this.viewport = previousViewport;
    this.selectedC = previousSelectedC;
    this.formulaParams = previousFormulaParams;
    this.renderSettings = previousRenderSettings;
    this.customSeed = previousCustomSeed;
    await this.setFormula(previousFormula, this.formulaParams);
    this.render();

    return blob;
  }
}
