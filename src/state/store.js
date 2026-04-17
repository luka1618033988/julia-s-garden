function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withId(items) {
  return items.map((item) => ({
    ...item,
    id: item.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  }));
}

export function createAppState(initialState) {
  let state = clone(initialState);
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) listener(state);
  }

  function setState(updater) {
    const nextState = typeof updater === "function" ? updater(state) : updater;
    state = nextState;
    emit();
  }

  const actions = {
    setFormula(activeFormulaId, formulaParams) {
      setState((current) => ({
        ...current,
        activeFormulaId,
        formulaParams: { ...current.formulaParams, ...formulaParams },
      }));
    },
    setFormulaParams(partial) {
      setState((current) => ({
        ...current,
        formulaParams: { ...current.formulaParams, ...partial },
      }));
    },
    setRenderSettings(partial) {
      setState((current) => ({
        ...current,
        renderSettings: { ...current.renderSettings, ...partial },
      }));
    },
    setSelectedC(selectedC) {
      setState((current) => ({
        ...current,
        selectedC,
        interaction: { ...current.interaction, hoverC: selectedC },
      }));
    },
    setViewport(surface, viewport) {
      setState((current) => ({
        ...current,
        [surface]: viewport,
      }));
    },
    setInteraction(partial) {
      setState((current) => ({
        ...current,
        interaction: { ...current.interaction, ...partial },
      }));
    },
    setCustomFormula(customFormula) {
      setState((current) => ({
        ...current,
        customFormula,
      }));
    },
    setCustomSeed(partial) {
      setState((current) => ({
        ...current,
        customSeed: { ...current.customSeed, ...partial },
      }));
    },
    setDisplayOptions(surface, partial) {
      setState((current) => ({
        ...current,
        displayOptions: {
          ...current.displayOptions,
          [surface]: {
            ...current.displayOptions[surface],
            ...partial,
          },
        },
      }));
    },
    applyPreset(preset) {
      setState((current) => ({
        ...current,
        activeFormulaId: preset.activeFormulaId ?? current.activeFormulaId,
        formulaParams: { ...current.formulaParams, ...(preset.formulaParams ?? {}) },
        selectedC: preset.selectedC ?? current.selectedC,
        customFormula: preset.customFormula ?? current.customFormula,
        customSeed: preset.customSeed ?? current.customSeed,
        mandelbrotViewport:
          preset.mandelbrotViewport ?? current.mandelbrotViewport,
        juliaViewport: preset.juliaViewport ?? current.juliaViewport,
        renderSettings: {
          ...current.renderSettings,
          ...(preset.renderSettings ?? {}),
        },
      }));
    },
    loadSavedPresets(savedPresets) {
      setState((current) => ({
        ...current,
        savedPresets: withId(savedPresets),
      }));
    },
    createSnapshot(name) {
      const current = state;
      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        activeFormulaId: current.activeFormulaId,
        formulaParams: clone(current.formulaParams),
        selectedC: clone(current.selectedC),
        customFormula: current.customFormula,
        customSeed: clone(current.customSeed),
        mandelbrotViewport: clone(current.mandelbrotViewport),
        juliaViewport: clone(current.juliaViewport),
        renderSettings: clone(current.renderSettings),
      };
    },
  };

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
  };
}
