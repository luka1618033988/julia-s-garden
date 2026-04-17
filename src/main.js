import { createAppState } from "./state/store.js";
import { createPresetStorage } from "./storage/presets.js";
import { FORMULAS, createCustomFormula, getFormulaById } from "./formulas/registry.js";
import { LANDMARK_PRESETS } from "./rendering/landmarks.js";
import { createAppUi } from "./ui/app-ui.js";
import { createRenderCoordinator } from "./rendering/render-coordinator.js";

function parseScalar(input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value || value === "0") return 0;
  if (value === "pi") return Math.PI;
  if (value === "-pi") return -Math.PI;
  if (value === "e") return Math.E;
  if (value === "phi") return (1 + Math.sqrt(5)) / 2;
  if (value === "-phi") return -((1 + Math.sqrt(5)) / 2);
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  throw new Error(`Could not parse "${input}" as a number.`);
}

async function main() {
  const appState = createAppState({
    formulas: FORMULAS,
    activeFormulaId: FORMULAS[0].id,
    formulaParams: { ...FORMULAS[0].defaultParams },
    customFormula: "z*z + c",
    customSeed: { x: 0, y: 0, real: "0", imag: "0" },
    selectedC: { x: -0.8, y: 0.156 },
    mandelbrotViewport: { centerX: -0.5, centerY: 0, spanY: 2.8 },
    juliaViewport: { centerX: 0, centerY: 0, spanY: 2.8 },
    renderSettings: {
      maxIterations: 180,
      palette: "nebula",
      qualityMode: "balanced",
    },
    builtInPresets: LANDMARK_PRESETS,
    savedPresets: [],
    displayOptions: {
      mandelbrot: { showGrid: false },
      julia: { showGrid: false },
    },
    interaction: {
      activeSurface: null,
      isInteracting: false,
      hoverC: { x: -0.8, y: 0.156 },
      lockedC: false,
    },
  });

  const presetStorage = createPresetStorage("fractal-webgpu-presets");
  appState.actions.loadSavedPresets(presetStorage.load());

  const ui = createAppUi(document.querySelector("#app"), appState);
  const coordinator = createRenderCoordinator({
    appState,
    canvases: ui.canvases,
    status: ui.status,
  });

  ui.bindActions({
    onFormulaChange(formulaId) {
      const formula = getFormulaById(formulaId);
      const nextParams = { ...formula.defaultParams };
      appState.actions.setFormula(formulaId, nextParams);
      if (formulaId === "c-sine") {
        appState.actions.setCustomSeed({
          x: Math.PI,
          y: 0,
          real: "pi",
          imag: "0",
        });
      }
      if (formulaId === "sine") {
        appState.actions.setCustomSeed({
          x: 0,
          y: 0,
          real: "0",
          imag: "0",
        });
      }
    },
    onDegreeChange(degree) {
      appState.actions.setFormulaParams({ degree });
    },
    onCustomFormulaChange(customFormula) {
      const nextFormula = customFormula.trim() || "z*z + c";
      try {
        createCustomFormula(nextFormula);
        appState.actions.setCustomFormula(nextFormula);
        appState.actions.setFormula("custom", appState.getState().formulaParams);
        ui.showFatalError("");
      } catch (error) {
        ui.showFatalError(error instanceof Error ? error.message : String(error));
      }
    },
    onCustomSeedChange(realInput, imagInput) {
      try {
        appState.actions.setCustomSeed({
          x: parseScalar(realInput),
          y: parseScalar(imagInput),
          real: realInput.trim() || "0",
          imag: imagInput.trim() || "0",
        });
        ui.showFatalError("");
      } catch (error) {
        ui.showFatalError(error instanceof Error ? error.message : String(error));
      }
    },
    onIterationChange(maxIterations) {
      appState.actions.setRenderSettings({ maxIterations });
    },
    onPaletteChange(palette) {
      appState.actions.setRenderSettings({ palette });
    },
    onQualityChange(qualityMode) {
      appState.actions.setRenderSettings({ qualityMode });
    },
    onToggleCLock() {
      const lockedC = !appState.getState().interaction.lockedC;
      appState.actions.setInteraction({ lockedC });
    },
    onToggleGrid(surface) {
      const current = appState.getState().displayOptions[surface]?.showGrid;
      appState.actions.setDisplayOptions(surface, { showGrid: !current });
    },
    onExportSurface(surface) {
      coordinator.exportSurface(surface).catch((error) => {
        ui.showFatalError(error instanceof Error ? error.message : String(error));
      });
    },
    onResetSurface(surface) {
      coordinator.resetSurface(surface);
    },
    onSelectBuiltInPreset(preset) {
      appState.actions.applyPreset(preset);
    },
    onSelectBuiltInPresetById(id) {
      const preset = appState.getState().builtInPresets.find((item) => item.id === id);
      if (preset) {
        appState.actions.applyPreset(preset);
      }
    },
    onSelectSavedPreset(preset) {
      appState.actions.applyPreset(preset);
    },
    onSavePreset(name) {
      const snapshot = appState.actions.createSnapshot(name.trim());
      if (!snapshot.name) return;
      const nextPresets = presetStorage.save(snapshot);
      appState.actions.loadSavedPresets(nextPresets);
    },
    onDeleteSavedPreset(id) {
      const nextPresets = presetStorage.remove(id);
      appState.actions.loadSavedPresets(nextPresets);
    },
  });

  appState.subscribe((state) => {
    ui.render(state);
  });

  ui.render(appState.getState());

  try {
    await coordinator.initialize();
  } catch (error) {
    ui.showFatalError(error instanceof Error ? error.message : String(error));
    return;
  }

  window.addEventListener("unhandledrejection", (event) => {
    ui.showFatalError(
      event.reason instanceof Error ? event.reason.message : String(event.reason),
    );
  });

  appState.actions.setFormula(
    appState.getState().activeFormulaId,
    appState.getState().formulaParams,
  );
}

main();
