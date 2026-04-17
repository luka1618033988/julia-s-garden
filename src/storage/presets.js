export function createPresetStorage(key) {
  function load() {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  }

  function write(presets) {
    localStorage.setItem(key, JSON.stringify(presets));
    return presets;
  }

  return {
    load,
    save(preset) {
      return write([preset, ...load()]);
    },
    remove(id) {
      return write(load().filter((preset) => preset.id !== id));
    },
    sync(presets) {
      localStorage.setItem(key, JSON.stringify(presets));
    },
  };
}
