let runtimePromise = null;

export async function getWebGpuRuntime() {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not available in this browser.");
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("No suitable WebGPU adapter was found.");
      }

      const device = await adapter.requestDevice();
      const format = navigator.gpu.getPreferredCanvasFormat();
      return { adapter, device, format };
    })();
  }

  return runtimePromise;
}

export async function initializeWebGpu(canvas) {
  const runtime = await getWebGpuRuntime();
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("The canvas could not create a WebGPU context.");
  }
  return { ...runtime, context };
}
