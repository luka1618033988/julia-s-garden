import { getFormulaById } from "../formulas/registry.js";

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function chooseStep(span, targetLines) {
  const rough = span / Math.max(targetLines, 1);
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rough, Number.EPSILON)));
  const normalized = rough / magnitude;
  if (normalized < 1.5) return magnitude;
  if (normalized < 3.5) return 2 * magnitude;
  if (normalized < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

function formatGridNumber(value) {
  const rounded = Math.abs(value) < 1e-9 ? 0 : value;
  const abs = Math.abs(rounded);
  if (abs >= 1000 || (abs > 0 && abs < 0.01)) {
    return rounded.toExponential(1);
  }
  return Number(rounded.toFixed(abs >= 10 ? 0 : abs >= 1 ? 1 : 2)).toString();
}

function appendGridLabel(overlay, className, x, y, text) {
  const label = document.createElement("span");
  label.className = `grid-label ${className}`;
  label.textContent = text;
  label.style.left = `${x}px`;
  label.style.top = `${y}px`;
  overlay.append(label);
}

function updateGridOverlay(overlay, canvas, viewport) {
  if (!overlay || !canvas || !viewport) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const spanY = viewport.spanY;
  const spanX = spanY * (width / height);
  const left = viewport.centerX - spanX / 2;
  const top = viewport.centerY + spanY / 2;
  const minorStepX = chooseStep(spanX, 8);
  const minorStepY = chooseStep(spanY, 8);
  const majorStepX = minorStepX * 5;
  const majorStepY = minorStepY * 5;
  const minorPxX = (minorStepX / spanX) * width;
  const minorPxY = (minorStepY / spanY) * height;
  const majorPxX = (majorStepX / spanX) * width;
  const majorPxY = (majorStepY / spanY) * height;
  const axisXPx = ((0 - left) / spanX) * width;
  const axisYPx = ((top - 0) / spanY) * height;
  overlay.querySelectorAll(".grid-label").forEach((label) => label.remove());

  overlay.style.setProperty("--minor-x", `${minorPxX}px`);
  overlay.style.setProperty("--minor-y", `${minorPxY}px`);
  overlay.style.setProperty("--major-x", `${majorPxX}px`);
  overlay.style.setProperty("--major-y", `${majorPxY}px`);
  overlay.style.setProperty("--minor-offset-x", `${mod(axisXPx, minorPxX || 1)}px`);
  overlay.style.setProperty("--minor-offset-y", `${mod(axisYPx, minorPxY || 1)}px`);
  overlay.style.setProperty("--major-offset-x", `${mod(axisXPx, majorPxX || 1)}px`);
  overlay.style.setProperty("--major-offset-y", `${mod(axisYPx, majorPxY || 1)}px`);
  overlay.style.setProperty("--axis-x", `${axisXPx}px`);
  overlay.style.setProperty("--axis-y", `${axisYPx}px`);

  if (axisYPx >= 0 && axisYPx <= height) {
    const startX = Math.ceil(left / majorStepX) * majorStepX;
    const endX = Math.floor((left + spanX) / majorStepX) * majorStepX;
    for (let value = startX; value <= endX + majorStepX * 0.5; value += majorStepX) {
      const px = ((value - left) / spanX) * width;
      if (px < 0 || px > width || Math.abs(value) < majorStepX * 0.1) continue;
      appendGridLabel(overlay, "grid-label-x", px, axisYPx, formatGridNumber(value));
    }
    if (axisXPx >= 0 && axisXPx <= width) {
      appendGridLabel(overlay, "grid-label-origin", axisXPx, axisYPx, "0");
    }
  }

  if (axisXPx >= 0 && axisXPx <= width) {
    const bottom = top - spanY;
    const startY = Math.ceil(bottom / majorStepY) * majorStepY;
    const endY = Math.floor(top / majorStepY) * majorStepY;
    for (let value = startY; value <= endY + majorStepY * 0.5; value += majorStepY) {
      const py = ((top - value) / spanY) * height;
      if (py < 0 || py > height || Math.abs(value) < majorStepY * 0.1) continue;
      const label =
        Math.abs(Math.abs(value) - 1) < 1e-9
          ? `${value < 0 ? "-" : ""}i`
          : `${formatGridNumber(value)}i`;
      appendGridLabel(overlay, "grid-label-y", axisXPx, py, label);
    }
  }
}

function optionMarkup(items, getValue, getLabel) {
  return items
    .map((item) => `<option value="${getValue(item)}">${getLabel(item)}</option>`)
    .join("");
}

function presetButtonMarkup(preset, source) {
  const removeButton =
    source === "saved"
      ? `<button type="button" data-delete-preset="${preset.id}" class="danger">Delete</button>`
      : "";
  return `
    <div class="preset-item">
      <button type="button" data-select-preset="${preset.id}" data-preset-source="${source}">${preset.name}</button>
      ${removeButton}
    </div>
  `;
}

export function createAppUi(root, appState) {
  root.innerHTML = `
    <div class="layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-head">
          <button id="sidebar-toggle" type="button" class="ghost-button icon-button" aria-expanded="true" aria-label="Toggle settings">&#9881;</button>
        </div>
        <div>
          <h1>Julia's Garden</h1>
          <p class="lead">Explore Mandelbrot landmarks, hover for live Julia updates.</p>
        </div>
        <div class="controls">
          <div class="field">
            <label for="formula-select">Formula family</label>
            <div class="select-shell">
              <select id="formula-select" class="control-select">${optionMarkup(
              appState.getState().formulas,
              (formula) => formula.id,
              (formula) => formula.name,
            )}</select>
            </div>
          </div>
          <div class="field" id="degree-field">
            <div class="field-row">
              <label for="degree-range">Polynomial degree</label>
              <output id="degree-value"></output>
            </div>
            <input id="degree-range" type="range" min="2" max="8" step="1" />
          </div>
          <div class="field" id="custom-formula-field">
            <label for="custom-formula-input">Custom formula</label>
            <input id="custom-formula-input" type="text" placeholder="Examples: z*z + c, c*sin(z), sin(z) + c" />
            <div class="field-hint">Allowed: z, c, numbers, pi, e, phi, +, -, *, /, ^, parentheses, sin, cos, exp.</div>
          </div>
          <div class="field" id="custom-seed-field">
            <label>Custom start value z₀</label>
            <div class="complex-inputs">
              <input id="custom-seed-real" type="text" placeholder="real part, e.g. pi" />
              <input id="custom-seed-imag" type="text" placeholder="imag part, e.g. 0" />
            </div>
            <div class="field-hint">Used as the starting z value in the left parameter plane for custom formulas.</div>
          </div>
          <div class="field">
            <div class="field-row">
              <label for="iterations-range">Max iterations</label>
              <output id="iterations-value"></output>
            </div>
            <input id="iterations-range" type="range" min="40" max="1200" step="10" />
          </div>
          <div class="field">
            <label for="palette-select">Palette</label>
            <div class="select-shell">
              <select id="palette-select" class="control-select">
              <option value="nebula">Nebula</option>
              <option value="sunset">Sunset</option>
              <option value="ice">Ice</option>
              <option value="forest">Forest</option>
              <option value="ember">Ember</option>
              <option value="mono">Mono</option>
              <option value="aurora">Aurora</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="quality-select">Quality mode</label>
            <div class="select-shell">
              <select id="quality-select" class="control-select">
              <option value="balanced">Balanced</option>
              <option value="crisp">Crisp</option>
              <option value="fast">Fast</option>
              </select>
            </div>
          </div>
          <div class="field" id="landmarks-field">
            <label for="landmarks-select">Mandelbrot landmarks</label>
            <div class="select-shell">
              <select id="landmarks-select" class="control-select">
                <option value="">Choose a landmark</option>
                ${optionMarkup(
                  appState.getState().builtInPresets,
                  (preset) => preset.id,
                  (preset) => preset.name,
                )}
              </select>
            </div>
          </div>
          <div class="field">
            <div class="field-row">
              <div class="section-title">Julia lock</div>
              <button id="lock-c-toggle" type="button" class="ghost-button">Unlocked</button>
            </div>
            <div class="field-hint">Right click the Mandelbrot view, or hold Shift/Ctrl while hovering, to lock the current parameter in place.</div>
          </div>
          <div class="field">
            <div class="section-title">Save current view</div>
            <div class="save-row">
              <input id="preset-name" type="text" maxlength="40" placeholder="Preset name" />
              <button id="save-preset" type="button">Save</button>
            </div>
          </div>
          <div class="field">
            <div class="section-title">Saved presets</div>
            <div class="preset-list" id="saved-presets"></div>
          </div>
        </div>
      </aside>
      <main class="main">
        <section class="panel-shell status-bar">
          <div class="status-chip" id="status-formula"></div>
          <div class="status-chip" id="status-parameter"></div>
          <div class="status-chip" id="status-iterations"></div>
          <div class="status-chip" id="status-quality"></div>
        </section>
        <section class="canvas-grid">
          <article class="panel-shell canvas-card">
            <div class="canvas-head">
              <h2>Mandelbrot</h2>
              <div class="canvas-tools">
                <button type="button" class="ghost-button panel-action" data-reset-surface="mandelbrot">Reset</button>
                <button type="button" class="ghost-button panel-action" data-toggle-grid="mandelbrot">Grid</button>
                <button type="button" class="ghost-button panel-action" data-export-surface="mandelbrot">Export</button>
              </div>
            </div>
            <div class="canvas-wrap">
              <canvas id="mandelbrot-canvas"></canvas>
              <div class="grid-overlay" id="mandelbrot-grid">
                <div class="grid-axis grid-axis-x"></div>
                <div class="grid-axis grid-axis-y"></div>
              </div>
              <div class="canvas-overlay">
                <span>Drag to pan</span>
                <span>Scroll to zoom</span>
              </div>
            </div>
          </article>
          <article class="panel-shell canvas-card">
            <div class="canvas-head">
              <h2>Julia</h2>
              <div class="canvas-tools">
                <button type="button" class="ghost-button panel-action" data-reset-surface="julia">Reset</button>
                <button type="button" class="ghost-button panel-action" data-toggle-grid="julia">Grid</button>
                <button type="button" class="ghost-button panel-action" data-export-surface="julia">Export</button>
              </div>
            </div>
            <div class="canvas-wrap">
              <canvas id="julia-canvas"></canvas>
              <div class="grid-overlay" id="julia-grid">
                <div class="grid-axis grid-axis-x"></div>
                <div class="grid-axis grid-axis-y"></div>
              </div>
              <div class="canvas-overlay">
                <span>Independent pan and zoom</span>
                <span>Same formula family</span>
              </div>
            </div>
          </article>
        </section>
        <section id="fatal-slot"></section>
      </main>
    </div>
  `;

  const controls = {
    sidebar: root.querySelector("#sidebar"),
    sidebarToggle: root.querySelector("#sidebar-toggle"),
    formula: root.querySelector("#formula-select"),
    degreeField: root.querySelector("#degree-field"),
    degree: root.querySelector("#degree-range"),
    degreeValue: root.querySelector("#degree-value"),
    customFormulaField: root.querySelector("#custom-formula-field"),
    customFormula: root.querySelector("#custom-formula-input"),
    customSeedField: root.querySelector("#custom-seed-field"),
    customSeedReal: root.querySelector("#custom-seed-real"),
    customSeedImag: root.querySelector("#custom-seed-imag"),
    iterations: root.querySelector("#iterations-range"),
    iterationsValue: root.querySelector("#iterations-value"),
    palette: root.querySelector("#palette-select"),
    quality: root.querySelector("#quality-select"),
    landmarksField: root.querySelector("#landmarks-field"),
    landmarks: root.querySelector("#landmarks-select"),
    lockCToggle: root.querySelector("#lock-c-toggle"),
    presetName: root.querySelector("#preset-name"),
    savePreset: root.querySelector("#save-preset"),
    savedPresets: root.querySelector("#saved-presets"),
    fatalSlot: root.querySelector("#fatal-slot"),
  };

  const canvases = {
    mandelbrot: root.querySelector("#mandelbrot-canvas"),
    julia: root.querySelector("#julia-canvas"),
  };

  const overlays = {
    mandelbrotGrid: root.querySelector("#mandelbrot-grid"),
    juliaGrid: root.querySelector("#julia-grid"),
  };

  const status = {
    formula: root.querySelector("#status-formula"),
    parameter: root.querySelector("#status-parameter"),
    iterations: root.querySelector("#status-iterations"),
    quality: root.querySelector("#status-quality"),
  };

  let handlers = null;

  controls.formula.addEventListener("change", () => {
    handlers?.onFormulaChange(controls.formula.value);
  });
  controls.sidebarToggle.addEventListener("click", () => {
    const collapsed = controls.sidebar.classList.toggle("collapsed");
    controls.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    const state = appState.getState();
    requestAnimationFrame(() => {
      updateGridOverlay(overlays.mandelbrotGrid, canvases.mandelbrot, state.mandelbrotViewport);
      updateGridOverlay(overlays.juliaGrid, canvases.julia, state.juliaViewport);
    });
    handlers?.onSidebarToggle?.(collapsed);
  });
  controls.degree.addEventListener("input", () => {
    handlers?.onDegreeChange(Number(controls.degree.value));
  });
  controls.customFormula.addEventListener("change", () => {
    handlers?.onCustomFormulaChange(controls.customFormula.value);
  });
  controls.customSeedReal.addEventListener("change", () => {
    handlers?.onCustomSeedChange?.(controls.customSeedReal.value, controls.customSeedImag.value);
  });
  controls.customSeedImag.addEventListener("change", () => {
    handlers?.onCustomSeedChange?.(controls.customSeedReal.value, controls.customSeedImag.value);
  });
  controls.iterations.addEventListener("input", () => {
    handlers?.onIterationChange(Number(controls.iterations.value));
  });
  controls.palette.addEventListener("change", () => {
    handlers?.onPaletteChange(controls.palette.value);
  });
  controls.quality.addEventListener("change", () => {
    handlers?.onQualityChange(controls.quality.value);
  });
  controls.landmarks.addEventListener("change", () => {
    if (!controls.landmarks.value) return;
    handlers?.onSelectBuiltInPresetById?.(controls.landmarks.value);
  });
  controls.lockCToggle.addEventListener("click", () => {
    handlers?.onToggleCLock();
  });
  controls.savePreset.addEventListener("click", () => {
    handlers?.onSavePreset(controls.presetName.value);
    controls.presetName.value = "";
  });

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const selectTarget = event.target.closest("[data-select-preset]");
    if (selectTarget) {
      const source = selectTarget.dataset.presetSource;
      const key = selectTarget.dataset.selectPreset;
      const state = appState.getState();
      const pool = source === "saved" ? state.savedPresets : state.builtInPresets;
      const preset = pool.find((item) => item.id === key);
      if (preset) {
        if (source === "saved") handlers?.onSelectSavedPreset(preset);
        else handlers?.onSelectBuiltInPreset(preset);
      }
    }

    const deleteTarget = event.target.closest("[data-delete-preset]");
    if (deleteTarget) {
      handlers?.onDeleteSavedPreset(deleteTarget.dataset.deletePreset);
    }

    const gridTarget = event.target.closest("[data-toggle-grid]");
    if (gridTarget) {
      handlers?.onToggleGrid?.(gridTarget.dataset.toggleGrid);
    }

    const exportTarget = event.target.closest("[data-export-surface]");
    if (exportTarget) {
      handlers?.onExportSurface?.(exportTarget.dataset.exportSurface);
    }

    const resetTarget = event.target.closest("[data-reset-surface]");
    if (resetTarget) {
      handlers?.onResetSurface?.(resetTarget.dataset.resetSurface);
    }
  });

  return {
    canvases,
    status,
    bindActions(nextHandlers) {
      handlers = nextHandlers;
    },
    render(state) {
      const formula = getFormulaById(state.activeFormulaId);
      controls.formula.value = state.activeFormulaId;
      controls.degree.value = String(state.formulaParams.degree ?? formula.defaultParams.degree ?? 2);
      controls.degreeValue.textContent = controls.degree.value;
      const showDegree = formula.adjustableParams.some((param) => param.id === "degree");
      controls.degreeField.hidden = !showDegree;
      controls.degreeField.style.display = showDegree ? "" : "none";
      controls.customFormulaField.hidden = state.activeFormulaId !== "custom";
      controls.customFormulaField.style.display = state.activeFormulaId === "custom" ? "" : "none";
      const showCustomSeed =
        state.activeFormulaId === "custom" ||
        state.activeFormulaId === "c-sine" ||
        state.activeFormulaId === "sine";
      controls.customSeedField.hidden = !showCustomSeed;
      controls.customSeedField.style.display = showCustomSeed ? "" : "none";
      controls.customFormula.value = state.customFormula ?? "";
      controls.customSeedReal.value = state.customSeed?.real ?? "0";
      controls.customSeedImag.value = state.customSeed?.imag ?? "0";
      controls.iterations.value = String(state.renderSettings.maxIterations);
      controls.iterationsValue.textContent = String(state.renderSettings.maxIterations);
      controls.palette.value = state.renderSettings.palette;
      controls.quality.value = state.renderSettings.qualityMode;
      const showLandmarks =
        state.activeFormulaId === "power" && Number(state.formulaParams.degree ?? 2) === 2;
      controls.landmarksField.hidden = !showLandmarks;
      controls.landmarksField.style.display = showLandmarks ? "" : "none";
      controls.lockCToggle.textContent = state.interaction.lockedC ? "Locked" : "Unlocked";
      controls.lockCToggle.classList.toggle("active", state.interaction.lockedC);
      overlays.mandelbrotGrid.classList.toggle("visible", Boolean(state.displayOptions?.mandelbrot?.showGrid));
      overlays.juliaGrid.classList.toggle("visible", Boolean(state.displayOptions?.julia?.showGrid));
      updateGridOverlay(overlays.mandelbrotGrid, canvases.mandelbrot, state.mandelbrotViewport);
      updateGridOverlay(overlays.juliaGrid, canvases.julia, state.juliaViewport);
      controls.savedPresets.innerHTML = state.savedPresets.length
        ? state.savedPresets.map((preset) => presetButtonMarkup(preset, "saved")).join("")
        : `<div class="empty">No local presets saved yet.</div>`;
    },
    showFatalError(message) {
      controls.fatalSlot.innerHTML = message ? `<div class="fatal">${message}</div>` : "";
    },
  };
}
