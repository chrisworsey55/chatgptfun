const STORAGE_PREFIX = "quick-slides:deck:";
const HISTORY_PREFIX = "quick-slides:history:";
const COMMENT_PREFIX = "quick-slides:comments:";

function uuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function now() {
  return Date.now();
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to read storage", error);
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write storage", error);
  }
}

export class CollaborationService extends EventTarget {
  clientId = uuid();
  channel;
  websocket;
  websocketUrl;
  deckId;

  storeRemoteComment(comment) {
    if (!this.deckId || !comment) return;
    const comments = this.getComments();
    if (comments.some(entry => entry.id === comment.id)) return;
    comments.push(comment);
    writeLocal(this.commentKey, comments);
  }

  constructor(options = {}) {
    super();
    this.websocketUrl = options.websocketUrl;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel(options.channelName ?? "quick-slides");
        this.channel.onmessage = event => {
          if (!event.data || event.data.source === this.clientId) return;
          if (event.data.type === "comment") {
            this.storeRemoteComment(event.data.comment);
            this.dispatchEvent(new CustomEvent("comment:added", { detail: event.data }));
            return;
          }
          this.dispatchEvent(new CustomEvent("deck:update", { detail: event.data }));
        };
      }
    } catch (error) {
      console.warn("BroadcastChannel unavailable", error);
    }
  }

  connect(deckId) {
    this.deckId = deckId ?? uuid();
    if (this.websocketUrl) {
      try {
        this.websocket = new WebSocket(this.websocketUrl);
        this.websocket.addEventListener("message", event => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.source === this.clientId) return;
            if (payload.type === "comment") {
              this.storeRemoteComment(payload.comment);
              this.dispatchEvent(new CustomEvent("comment:added", { detail: payload }));
              return;
            }
            this.dispatchEvent(new CustomEvent("deck:update", { detail: payload }));
          } catch (error) {
            console.warn("Invalid websocket payload", error);
          }
        });
      } catch (error) {
        console.warn("WebSocket connection failed", error);
      }
    }
    return this.deckId;
  }

  get deckKey() {
    return `${STORAGE_PREFIX}${this.deckId}`;
  }

  get historyKey() {
    return `${HISTORY_PREFIX}${this.deckId}`;
  }

  get commentKey() {
    return `${COMMENT_PREFIX}${this.deckId}`;
  }

  loadDeck() {
    if (!this.deckId) return undefined;
    return readLocal(this.deckKey, undefined);
  }

  saveDeck(deck) {
    if (!this.deckId) {
      this.deckId = deck.id;
    }
    writeLocal(this.deckKey, deck);
    const history = this.getHistory();
    history.unshift({ ...deck });
    writeLocal(this.historyKey, history.slice(0, 20));
    const detail = { deck, source: this.clientId };
    if (this.channel) {
      this.channel.postMessage(detail);
    }
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(detail));
    }
    this.dispatchEvent(new CustomEvent("deck:saved", { detail }));
  }

  subscribe(handler) {
    const listener = event => {
      const custom = event;
      handler(custom.detail.deck);
    };
    this.addEventListener("deck:update", listener);
    const stored = this.loadDeck();
    if (stored) handler(stored);
    return () => this.removeEventListener("deck:update", listener);
  }

  getHistory() {
    if (!this.deckId) return [];
    return readLocal(this.historyKey, []);
  }

  addComment(comment) {
    if (this.deckId === undefined) throw new Error("Collaboration service not connected");
    const comments = this.getComments();
    const entry = {
      id: uuid(),
      createdAt: comment.createdAt ?? now(),
      author: comment.author,
      message: comment.message,
      slideIndex: comment.slideIndex,
    };
    comments.push(entry);
    writeLocal(this.commentKey, comments);
    const detail = { deck: this.loadDeck(), comment: entry, source: this.clientId };
    if (this.channel) {
      this.channel.postMessage({
        ...detail,
        type: "comment",
      });
    }
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ ...detail, type: "comment" }));
    }
    this.dispatchEvent(new CustomEvent("comment:added", { detail }));
    return entry;
  }

  getComments(slideIndex) {
    if (!this.deckId) return [];
    const comments = readLocal(this.commentKey, []);
    if (typeof slideIndex === "number") {
      return comments.filter(comment => comment.slideIndex === slideIndex);
    }
    return comments;
  }

  createShareLink(deck, options = {}) {
    if (options.persist !== false) {
      this.saveDeck(deck);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("deck", deck.id);
    return url.toString();
  }

  parseShareLink() {
    const params = new URLSearchParams(window.location.search);
    const deckId = params.get("deck");
    if (!deckId) return undefined;
    this.deckId = deckId;
    return this.loadDeck();
  }

  setDeckId(deckId) {
    this.deckId = deckId;
  }
}
