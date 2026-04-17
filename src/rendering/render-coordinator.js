import { FractalRenderer } from "./fractal-renderer.js";
import { createCustomFormula, getFormulaById } from "../formulas/registry.js";
import { panViewport, screenToComplex, zoomViewport } from "./viewport.js";

const DEFAULT_VIEWPORTS = {
  mandelbrotViewport: { centerX: -0.5, centerY: 0, spanY: 2.8 },
  juliaViewport: { centerX: 0, centerY: 0, spanY: 2.8 },
};

function debounce(fn, delay) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

function formatComplex(value) {
  return `${value.x.toFixed(6)} ${value.y < 0 ? "-" : "+"} ${Math.abs(value.y).toFixed(6)}i`;
}

export function createRenderCoordinator({ appState, canvases, status }) {
  const renderers = {
    mandelbrot: new FractalRenderer({
      canvas: canvases.mandelbrot,
      sceneType: "mandelbrot",
      label: "mandelbrot",
    }),
    julia: new FractalRenderer({
      canvas: canvases.julia,
      sceneType: "julia",
      label: "julia",
    }),
  };

  let frameHandle = 0;
  let resizeObserver = null;
  const settleInteraction = debounce(() => {
    appState.actions.setInteraction({ isInteracting: false, activeSurface: null });
    scheduleRender();
  }, 160);

  function getResolvedFormula(state) {
    return state.activeFormulaId === "custom"
      ? createCustomFormula(state.customFormula)
      : getFormulaById(state.activeFormulaId);
  }

  function updateStatus(state) {
    status.formula.textContent = getResolvedFormula(state).name;
    status.parameter.textContent = `c = ${formatComplex(state.selectedC)}`;
    status.iterations.textContent = `${state.renderSettings.maxIterations} iterations`;
    status.quality.textContent = state.interaction.isInteracting
      ? `Interactive ${state.renderSettings.qualityMode}`
      : `${state.interaction.lockedC ? "Locked" : "Live"} ${state.renderSettings.qualityMode}`;
  }

  function renderFromState() {
    frameHandle = 0;
    const state = appState.getState();
    const formula = getResolvedFormula(state);

    for (const [surface, renderer] of Object.entries(renderers)) {
      const canvas = canvases[surface];
      const rect = canvas.getBoundingClientRect();
      renderer.setViewport(state[`${surface}Viewport`]);
      renderer.setSelectedC(state.selectedC);
      renderer.setRenderSettings(state.renderSettings, state.formulaParams, state.customSeed);
      renderer.resize(rect.width, rect.height, state.interaction.isInteracting);
      renderer.render();
    }

    updateStatus(state);
    canvases.mandelbrot.dataset.meta = formula.description;
    canvases.julia.dataset.meta = formula.description;
  }

  function scheduleRender() {
    if (frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = requestAnimationFrame(renderFromState);
  }

  async function syncFormula(state) {
    const formula = getResolvedFormula(state);
    await Promise.all([
      renderers.mandelbrot.setFormula(formula, state.formulaParams),
      renderers.julia.setFormula(formula, state.formulaParams),
    ]);
    scheduleRender();
  }

  function attachCanvasInteractions(surface) {
    const canvas = canvases[surface];
    let drag = null;
    let dragged = false;

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      drag = { x: event.clientX, y: event.clientY };
      dragged = false;
      appState.actions.setInteraction({ isInteracting: true, activeSurface: surface });
      settleInteraction();
    });

    canvas.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      const viewport = appState.getState()[`${surface}Viewport`];
      const point = screenToComplex(
        viewport,
        rect.width,
        rect.height,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );

      if (
        surface === "mandelbrot" &&
        !appState.getState().interaction.lockedC &&
        !event.shiftKey &&
        !event.ctrlKey
      ) {
        appState.actions.setSelectedC(point);
      }

      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          dragged = true;
        }
        drag = { x: event.clientX, y: event.clientY };
        appState.actions.setViewport(
          `${surface}Viewport`,
          panViewport(viewport, rect.width, rect.height, dx, dy),
        );
        appState.actions.setInteraction({ isInteracting: true, activeSurface: surface });
      }

      settleInteraction();
      scheduleRender();
    });

    canvas.addEventListener("pointerup", (event) => {
      drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      settleInteraction();
    });

    canvas.addEventListener("pointercancel", () => {
      drag = null;
      dragged = false;
      settleInteraction();
    });

    canvas.addEventListener("pointerleave", () => {
      if (!drag) {
        settleInteraction();
      }
    });

    canvas.addEventListener("contextmenu", (event) => {
      if (surface !== "mandelbrot") return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const viewport = appState.getState().mandelbrotViewport;
      const point = screenToComplex(
        viewport,
        rect.width,
        rect.height,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      appState.actions.setSelectedC(point);
      appState.actions.setInteraction({ lockedC: !appState.getState().interaction.lockedC });
      scheduleRender();
    });

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const zoomFactor = event.deltaY > 0 ? 1.08 : 0.925;
      const viewport = appState.getState()[`${surface}Viewport`];
      appState.actions.setViewport(
        `${surface}Viewport`,
        zoomViewport(
          viewport,
          rect.width,
          rect.height,
          event.clientX - rect.left,
          event.clientY - rect.top,
          zoomFactor,
        ),
      );
      appState.actions.setInteraction({ isInteracting: true, activeSurface: surface });
      settleInteraction();
      scheduleRender();
    }, { passive: false });

    canvas.addEventListener("click", (event) => {
      if (surface !== "mandelbrot" || dragged) {
        dragged = false;
        return;
      }
      if (appState.getState().interaction.lockedC) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const viewport = appState.getState().mandelbrotViewport;
      const point = screenToComplex(
        viewport,
        rect.width,
        rect.height,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      appState.actions.setSelectedC(point);
      scheduleRender();
    });
  }

  return {
    resetSurface(surface) {
      const key = `${surface}Viewport`;
      const fallback = DEFAULT_VIEWPORTS[key];
      if (!fallback) return;
      appState.actions.setViewport(key, { ...fallback });
      appState.actions.setInteraction({ isInteracting: false, activeSurface: null });
      scheduleRender();
    },
    async exportSurface(surface) {
      const state = appState.getState();
      const formula = getResolvedFormula(state);
      const viewport = state[`${surface}Viewport`];
      const blob = await renderers[surface].exportImage({
        formula,
        viewport,
        selectedC: state.selectedC,
        formulaParams: state.formulaParams,
        renderSettings: { ...state.renderSettings, maxIterations: Math.max(800, state.renderSettings.maxIterations) },
        customSeed: state.customSeed,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${surface}-${Date.now()}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async initialize() {
      const state = appState.getState();
      const formula = getResolvedFormula(state);
      await Promise.all([
        renderers.mandelbrot.initialize(formula),
        renderers.julia.initialize(formula),
      ]);

      attachCanvasInteractions("mandelbrot");
      attachCanvasInteractions("julia");

      resizeObserver = new ResizeObserver(() => scheduleRender());
      resizeObserver.observe(canvases.mandelbrot);
      resizeObserver.observe(canvases.julia);

      let previousFormulaKey = `${state.activeFormulaId}:${state.customFormula}`;
      appState.subscribe(async (nextState) => {
        const nextFormulaKey = `${nextState.activeFormulaId}:${nextState.customFormula}`;
        if (nextFormulaKey !== previousFormulaKey) {
          previousFormulaKey = nextFormulaKey;
          await syncFormula(nextState);
          return;
        }
        scheduleRender();
      });

      scheduleRender();
    },
  };
}
