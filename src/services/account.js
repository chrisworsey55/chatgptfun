const STORAGE_KEY = "quick-slides:user";

function readUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Unable to read user", error);
    return null;
  }
}

function writeUser(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Unable to persist user", error);
  }
}

export class AccountService extends EventTarget {
  constructor() {
    super();
    this.user = readUser();
  }

  get currentUser() {
    return this.user;
  }

  signIn(profile) {
    const next = {
      id: profile.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
      name: profile.name,
      email: profile.email,
      organization: profile.organization ?? "",
      lastActiveAt: Date.now(),
    };
    this.user = next;
    writeUser(next);
    this.dispatchEvent(new CustomEvent("auth", { detail: { user: next } }));
    return next;
  }

  signOut() {
    writeUser(null);
    const previous = this.user;
    this.user = null;
    this.dispatchEvent(new CustomEvent("auth", { detail: { user: null, previous } }));
  }
}
