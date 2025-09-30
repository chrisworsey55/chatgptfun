const DEFAULT_FLAGS = {
  aiAssist: true,
  collab: true,
  teamWorkflows: false,
};

function parseBoolean(value) {
  if (value === undefined || value === null) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

function parseSearchOverrides() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const features = params.get("features");
  if (!features) return {};
  const overrides = {};
  features.split(",").map(flag => flag.trim()).filter(Boolean).forEach(flag => {
    overrides[flag] = true;
  });
  params.forEach((value, key) => {
    if (!key.startsWith("feature.")) return;
    overrides[key.replace("feature.", "")] = parseBoolean(value);
  });
  return overrides;
}

class FeatureFlagStore {
  constructor(defaults = {}) {
    this.defaults = { ...defaults };
    this.flags = { ...defaults, ...this.readPersisted(), ...parseSearchOverrides() };
  }

  readPersisted() {
    try {
      const raw = localStorage.getItem("quick-slides:flags");
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Unable to read feature flags", error);
      return {};
    }
  }

  persist() {
    try {
      localStorage.setItem("quick-slides:flags", JSON.stringify(this.flags));
    } catch (error) {
      console.warn("Unable to persist feature flags", error);
    }
  }

  isEnabled(flag) {
    return !!this.flags[flag];
  }

  set(flag, value) {
    this.flags[flag] = value;
    this.persist();
  }

  applyToDom(root = document) {
    root.querySelectorAll("[data-feature]").forEach(element => {
      const flag = element.getAttribute("data-feature");
      const enabled = this.isEnabled(flag);
      element.toggleAttribute("hidden", !enabled);
      element.classList.toggle("feature-hidden", !enabled);
    });
  }
}

export const featureFlags = new FeatureFlagStore(DEFAULT_FLAGS);
