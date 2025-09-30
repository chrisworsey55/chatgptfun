export interface SlideData {
  title: string;
  bullets: string[];
  notes?: string;
}

export interface DeckPayload {
  id: string;
  theme: string;
  slides: SlideData[];
  updatedAt: number;
  name?: string;
  ownerId?: string | null;
}

export interface CollaborationEventDetail {
  deck: DeckPayload;
  source: string;
}

export interface CommentPayload {
  id: string;
  author: string;
  message: string;
  slideIndex: number;
  createdAt: number;
}

export type CollaborationHandler = (deck: DeckPayload) => void;

const STORAGE_PREFIX = "quick-slides:deck:";
const HISTORY_PREFIX = "quick-slides:history:";
const COMMENT_PREFIX = "quick-slides:comments:";

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function now() {
  return Date.now();
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to read storage", error);
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write storage", error);
  }
}

export class CollaborationService extends EventTarget {
  private clientId = uuid();
  private channel?: BroadcastChannel;
  private websocket?: WebSocket;
  private websocketUrl?: string;
  private deckId?: string;

  private storeRemoteComment(comment?: CommentPayload) {
    if (!this.deckId || !comment) return;
    const comments = this.getComments();
    if (comments.some(entry => entry.id === comment.id)) return;
    comments.push(comment);
    writeLocal(this.commentKey, comments);
  }

  constructor(options?: { websocketUrl?: string; channelName?: string }) {
    super();
    this.websocketUrl = options?.websocketUrl;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel(options?.channelName ?? "quick-slides");
        this.channel.onmessage = (event: MessageEvent<any>) => {
          if (!event.data || event.data.source === this.clientId) return;
          if (event.data.type === "comment") {
            this.storeRemoteComment(event.data.comment);
            this.dispatchEvent(new CustomEvent("comment:added", { detail: event.data }));
            return;
          }
          this.dispatchEvent(new CustomEvent("deck:update", { detail: event.data as CollaborationEventDetail }));
        };
      }
    } catch (error) {
      console.warn("BroadcastChannel unavailable", error);
    }
  }

  connect(deckId?: string) {
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
            const detail = payload as CollaborationEventDetail;
            this.dispatchEvent(new CustomEvent("deck:update", { detail }));
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

  private get deckKey() {
    return `${STORAGE_PREFIX}${this.deckId}`;
  }

  private get historyKey() {
    return `${HISTORY_PREFIX}${this.deckId}`;
  }

  private get commentKey() {
    return `${COMMENT_PREFIX}${this.deckId}`;
  }

  loadDeck(): DeckPayload | undefined {
    if (!this.deckId) return undefined;
    return readLocal(this.deckKey, undefined);
  }

  saveDeck(deck: DeckPayload) {
    if (!this.deckId) {
      this.deckId = deck.id;
    }
    writeLocal(this.deckKey, deck);
    const history = this.getHistory();
    history.unshift({ ...deck });
    writeLocal(this.historyKey, history.slice(0, 20));
    const detail: CollaborationEventDetail = { deck, source: this.clientId };
    if (this.channel) {
      this.channel.postMessage(detail);
    }
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(detail));
    }
    this.dispatchEvent(new CustomEvent("deck:saved", { detail }));
  }

  subscribe(handler: CollaborationHandler) {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<CollaborationEventDetail>;
      handler(custom.detail.deck);
    };
    this.addEventListener("deck:update", listener as EventListener);
    const stored = this.loadDeck();
    if (stored) handler(stored);
    return () => this.removeEventListener("deck:update", listener as EventListener);
  }

  getHistory(): DeckPayload[] {
    if (!this.deckId) return [];
    return readLocal(this.historyKey, []);
  }

  addComment(comment: Omit<CommentPayload, "id" | "createdAt"> & { createdAt?: number }) {
    if (this.deckId === undefined) throw new Error("Collaboration service not connected");
    const comments = this.getComments();
    const entry: CommentPayload = {
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
      } as any);
    }
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ ...detail, type: "comment" }));
    }
    this.dispatchEvent(new CustomEvent("comment:added", { detail }));
    return entry;
  }

  getComments(slideIndex?: number) {
    if (!this.deckId) return [] as CommentPayload[];
    const comments = readLocal<CommentPayload[]>(this.commentKey, []);
    if (typeof slideIndex === "number") {
      return comments.filter(comment => comment.slideIndex === slideIndex);
    }
    return comments;
  }

  createShareLink(deck: DeckPayload, options?: { persist?: boolean }) {
    if (options?.persist !== false) {
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

  setDeckId(deckId: string) {
    this.deckId = deckId;
  }
}
