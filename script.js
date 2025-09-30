import { createExportService } from "./src/services/export.js";
import { CollaborationService } from "./src/services/collab.js";
import { AiService } from "./src/services/ai.js";
import { featureFlags } from "./src/services/featureFlags.js";
import { AccountService } from "./src/services/account.js";

const input = document.getElementById("inputText");
const slidesEl = document.getElementById("slides");
const generateBtn = document.getElementById("generateBtn");
const presentBtn = document.getElementById("presentBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const themeSelect = document.getElementById("themeSelect");
const exportFormatSelect = document.getElementById("exportFormat");
const exportPipelineSelect = document.getElementById("exportPipeline");
const exportBtn = document.getElementById("exportBtn");
const shareBtn = document.getElementById("shareBtn");
const shareLink = document.getElementById("shareLink");
const collabStatus = document.getElementById("collabStatus");
const syncBtn = document.getElementById("syncBtn");
const historyList = document.getElementById("historyList");
const commentList = document.getElementById("commentList");
const commentInput = document.getElementById("commentInput");
const commentSubmit = document.getElementById("commentSubmit");
const aiPrompt = document.getElementById("aiPrompt");
const aiDraftBtn = document.getElementById("aiDraftBtn");
const aiToneSelect = document.getElementById("aiTone");
const aiToneBtn = document.getElementById("aiToneBtn");
const aiTopicInput = document.getElementById("aiTopic");
const aiSuggestBtn = document.getElementById("aiSuggestBtn");
const aiSuggestionsList = document.getElementById("aiSuggestions");
const accountBtn = document.getElementById("accountBtn");
const userBadge = document.getElementById("userBadge");
const accountDialog = document.getElementById("accountDialog");
const accountForm = document.getElementById("accountForm");
const accountNameInput = document.getElementById("accountName");
const accountEmailInput = document.getElementById("accountEmail");
const accountOrgInput = document.getElementById("accountOrg");
const signOutBtn = document.getElementById("signOutBtn");

const STORAGE_KEY = "quick-slides-input";
const THEME_KEY = "quick-slides-theme";
const DECK_NAME_KEY = "quick-slides-deck-name";
const DECK_ID_KEY = "quick-slides-deck-id";

featureFlags.applyToDom(document);

const exportService = createExportService({ defaultPipeline: "wasm" });
const collabService = new CollaborationService();
const aiService = new AiService();
const accountService = new AccountService();

let slides = [];
let current = 0;
let deckId = "";
let aiDrafts = [];

function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function parseSlides(text) {
  const raw = text.split(/\n\s*\n|^\s*---\s*$/m).map(s => s.trim()).filter(Boolean);
  return raw.map(block => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    const title = lines.shift() || "";
    return { title, bullets: lines };
  });
}

function stringifySlides(collection) {
  return collection
    .map(slide => [slide.title, ...slide.bullets].join("\n"))
    .join("\n\n");
}

function renderSlides() {
  slidesEl.innerHTML = "";
  slides.forEach((slide, index) => {
    const card = document.createElement("div");
    card.className = "slide";
    if (index === current) card.classList.add("active");
    const h = document.createElement("h2");
    h.textContent = slide.title;
    card.appendChild(h);
    slide.bullets.forEach(bullet => {
      const p = document.createElement("p");
      p.textContent = bullet;
      card.appendChild(p);
    });
    const num = document.createElement("div");
    num.className = "num";
    num.textContent = `${index + 1}/${slides.length}`;
    card.appendChild(num);
    card.addEventListener("click", () => {
      current = index;
      showCurrent();
    });
    slidesEl.appendChild(card);
  });
}

function showCurrent() {
  const cards = Array.from(document.querySelectorAll(".slide"));
  cards.forEach((card, index) => {
    const isActive = index === current;
    card.classList.toggle("active", isActive);
    if (document.documentElement.classList.contains("present")) {
      card.style.display = isActive ? "flex" : "none";
    } else {
      card.style.display = "flex";
    }
  });
  renderComments(current);
}

function startPresentation() {
  if (!slides.length) generate();
  document.documentElement.classList.add("present");
  current = 0;
  showCurrent();
}

function endPresentation() {
  document.documentElement.classList.remove("present");
  showCurrent();
}

function next() {
  if (current < slides.length - 1) {
    current += 1;
    showCurrent();
  }
}

function prev() {
  if (current > 0) {
    current -= 1;
    showCurrent();
  }
}

function applyTheme(name) {
  const allowed = ["light", "dark", "contrast", "clean"];
  const theme = allowed.includes(name) ? name : "light";
  themeSelect.value = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function getDeckSnapshot(overrides = {}) {
  const theme = themeSelect.value || "light";
  const name = localStorage.getItem(DECK_NAME_KEY) || slides[0]?.title || "quick-slides";
  return {
    id: deckId || localStorage.getItem(DECK_ID_KEY) || uuid(),
    theme,
    slides: slides.map(slide => ({ ...slide })),
    updatedAt: Date.now(),
    name,
    ownerId: accountService.currentUser?.id ?? null,
    ...overrides,
  };
}

async function exportDeck() {
  if (!slides.length) generate();
  const format = exportFormatSelect.value;
  const pipeline = exportPipelineSelect.value;
  try {
    const deck = getDeckSnapshot();
    const result = await exportService.exportDeck({
      format,
      pipeline,
      deck,
    });
    await exportService.download(result);
  } catch (error) {
    console.error("Export failed", error);
    exportBtn.textContent = "Export failed";
    setTimeout(() => (exportBtn.textContent = "Export deck"), 1500);
  }
}

function updateShareLink(deck) {
  if (!featureFlags.isEnabled("collab") || !shareLink) return;
  const link = collabService.createShareLink(deck, { persist: false });
  shareLink.value = link;
}

async function copyShareLink() {
  if (!shareLink) return;
  if (!shareLink.value) {
    const deck = getDeckSnapshot();
    updateShareLink(deck);
  }
  try {
    await navigator.clipboard.writeText(shareLink.value);
    shareBtn.textContent = "Copied!";
    setTimeout(() => (shareBtn.textContent = "Copy share link"), 1500);
  } catch (error) {
    console.warn("Clipboard unavailable", error);
    shareLink.select();
  }
}

function updateCollabStatus(state) {
  if (!collabStatus) return;
  collabStatus.textContent = state;
  collabStatus.dataset.state = state;
}

function syncDeck() {
  const deck = collabService.loadDeck();
  if (deck) {
    applyRemoteDeck(deck);
  }
}

function updateHistory() {
  if (!featureFlags.isEnabled("teamWorkflows") || !historyList) return;
  const history = collabService.getHistory();
  historyList.innerHTML = "";
  history.forEach(entry => {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = entry.name || entry.slides[0]?.title || "Deck";
    const meta = document.createElement("span");
    meta.textContent = `${new Date(entry.updatedAt).toLocaleString()} · ${entry.slides.length} slides`;
    const restoreBtn = document.createElement("button");
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => applyRemoteDeck(entry));
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(restoreBtn);
    historyList.appendChild(li);
  });
}

function renderComments(slideIndex) {
  if (!featureFlags.isEnabled("teamWorkflows") || !commentList) return;
  commentList.innerHTML = "";
  const comments = collabService.getComments(slideIndex);
  comments
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach(comment => {
      const li = document.createElement("li");
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${comment.author} • ${new Date(comment.createdAt).toLocaleTimeString()}`;
      li.appendChild(meta);
      li.appendChild(document.createTextNode(comment.message));
      commentList.appendChild(li);
    });
}

function submitComment() {
  if (!featureFlags.isEnabled("teamWorkflows")) return;
  const message = commentInput.value.trim();
  if (!message) return;
  const author = accountService.currentUser?.name || "Guest";
  try {
    collabService.addComment({
      author,
      message,
      slideIndex: current,
    });
    commentInput.value = "";
    renderComments(current);
  } catch (error) {
    console.error("Unable to add comment", error);
  }
}

function renderSuggestions(suggestions) {
  if (!aiSuggestionsList) return;
  aiSuggestionsList.innerHTML = "";
  suggestions.forEach((suggestion, index) => {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = suggestion.title;
    const details = document.createElement("p");
    details.textContent = suggestion.bullets.join(" • ");
    const rationale = document.createElement("small");
    rationale.textContent = suggestion.rationale;
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add to deck";
    addBtn.addEventListener("click", () => {
      slides.push({ title: suggestion.title, bullets: suggestion.bullets });
      current = slides.length - 1;
      renderSlides();
      showCurrent();
      updateInputFromSlides();
      persistDeck();
    });
    li.appendChild(title);
    li.appendChild(details);
    li.appendChild(rationale);
    li.appendChild(addBtn);
    aiSuggestionsList.appendChild(li);
    if (!suggestion.id) suggestion.id = index;
  });
}

async function handleDraft() {
  const prompt = aiPrompt.value.trim();
  if (!prompt) return;
  aiDraftBtn.disabled = true;
  aiDraftBtn.textContent = "Drafting…";
  try {
    aiDrafts = await aiService.draftSlides({ prompt });
    if (aiDrafts.length) {
      slides = aiDrafts.map(slide => ({ title: slide.title, bullets: slide.bullets }));
      current = 0;
      renderSlides();
      showCurrent();
      updateInputFromSlides();
      persistDeck();
    }
    renderSuggestions(aiDrafts);
  } finally {
    aiDraftBtn.disabled = false;
    aiDraftBtn.textContent = "Draft slides";
  }
}

function applyTone() {
  if (!slides.length) return;
  const suggestions = slides.map(slide => ({ title: slide.title, bullets: slide.bullets, rationale: "" }));
  const toned = aiService.adjustTone(suggestions, { tone: aiToneSelect.value });
  slides = toned.map((slide, index) => ({ ...slides[index], bullets: slide.bullets }));
  renderSlides();
  showCurrent();
  updateInputFromSlides();
  persistDeck();
}

function suggestAdditionalSlide() {
  const topic = aiTopicInput.value.trim();
  const suggestion = aiService.suggestSlide(slides.map(slide => ({ title: slide.title, bullets: slide.bullets, rationale: "" })), topic);
  aiDrafts = [suggestion, ...aiDrafts];
  renderSuggestions(aiDrafts);
}

function updateInputFromSlides() {
  input.value = stringifySlides(slides);
  localStorage.setItem(STORAGE_KEY, input.value);
}

function persistDeck() {
  const deck = getDeckSnapshot({ slides: slides.map(slide => ({ ...slide })) });
  deckId = deck.id;
  collabService.setDeckId(deckId);
  collabService.saveDeck(deck);
  localStorage.setItem(DECK_ID_KEY, deckId);
  localStorage.setItem(DECK_NAME_KEY, deck.slides[0]?.title || deck.name || "");
  updateHistory();
  updateShareLink(deck);
}

function generate() {
  slides = parseSlides(input.value);
  current = Math.min(current, slides.length - 1);
  if (current < 0) current = 0;
  renderSlides();
  showCurrent();
  persistDeck();
}

function applyRemoteDeck(deck) {
  deckId = deck.id;
  collabService.setDeckId(deckId);
  slides = deck.slides || [];
  const theme = deck.theme || themeSelect.value;
  applyTheme(theme);
  input.value = stringifySlides(slides);
  localStorage.setItem(STORAGE_KEY, input.value);
  localStorage.setItem(DECK_NAME_KEY, deck.name || "");
  localStorage.setItem(DECK_ID_KEY, deck.id);
  renderSlides();
  current = 0;
  showCurrent();
  updateHistory();
  updateShareLink(deck);
}

function hydrateFromShareLink() {
  const sharedDeck = collabService.parseShareLink();
  if (sharedDeck) {
    applyRemoteDeck(sharedDeck);
    return sharedDeck.id;
  }
  const storedId = localStorage.getItem(DECK_ID_KEY);
  if (storedId) {
    collabService.setDeckId(storedId);
    deckId = storedId;
    const storedDeck = collabService.loadDeck();
    if (storedDeck) {
      applyRemoteDeck(storedDeck);
      return storedDeck.id;
    }
  }
  const stored = collabService.loadDeck();
  if (stored) {
    applyRemoteDeck(stored);
    return stored.id;
  }
  return uuid();
}

function updateAccountUi() {
  const user = accountService.currentUser;
  if (user) {
    userBadge.textContent = user.name;
    accountBtn.textContent = "Manage";
  } else {
    userBadge.textContent = "Guest";
    accountBtn.textContent = "Sign in";
  }
}

function initAccount() {
  updateAccountUi();
  accountBtn?.addEventListener("click", () => {
    if (!featureFlags.isEnabled("teamWorkflows")) return;
    if (typeof accountDialog.showModal === "function") {
      const user = accountService.currentUser;
      if (accountNameInput) accountNameInput.value = user?.name || "";
      if (accountEmailInput) accountEmailInput.value = user?.email || "";
      if (accountOrgInput) accountOrgInput.value = user?.organization || "";
      accountDialog.showModal();
    }
  });
  accountForm?.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(accountForm);
    accountService.signIn({
      name: data.get("name")?.toString() || "",
      email: data.get("email")?.toString() || "",
      organization: data.get("organization")?.toString() || "",
    });
    accountDialog.close();
    updateAccountUi();
    persistDeck();
  });
  signOutBtn?.addEventListener("click", () => {
    accountService.signOut();
    accountDialog.close();
    updateAccountUi();
    persistDeck();
  });
}

function initCollab() {
  if (!featureFlags.isEnabled("collab")) return;
  const initialDeckId = hydrateFromShareLink();
  deckId = collabService.connect(initialDeckId);
  updateCollabStatus("connected");
  collabService.subscribe(deck => {
    applyRemoteDeck(deck);
  });
  collabService.addEventListener("deck:saved", () => updateCollabStatus("synced"));
  collabService.addEventListener("comment:added", event => {
    const detail = event.detail;
    if (detail?.comment?.slideIndex === current) {
      renderComments(current);
    }
  });
}

function initLocalState() {
  const storedInput = localStorage.getItem(STORAGE_KEY);
  if (storedInput) {
    input.value = storedInput;
  }
  const storedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(storedTheme);
  const deckName = slides[0]?.title || "Quick deck";
  localStorage.setItem(DECK_NAME_KEY, deckName);
}

generateBtn.addEventListener("click", generate);
presentBtn.addEventListener("click", () => {
  if (document.documentElement.classList.contains("present")) endPresentation();
  else startPresentation();
});
nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);
exportBtn?.addEventListener("click", exportDeck);
shareBtn?.addEventListener("click", copyShareLink);
syncBtn?.addEventListener("click", syncDeck);
commentSubmit?.addEventListener("click", submitComment);
aiDraftBtn?.addEventListener("click", handleDraft);
aiToneBtn?.addEventListener("click", applyTone);
aiSuggestBtn?.addEventListener("click", suggestAdditionalSlide);

document.addEventListener("keydown", event => {
  if (event.key === "ArrowRight") next();
  if (event.key === "ArrowLeft") prev();
  if (event.key === "Escape") endPresentation();
});

themeSelect.addEventListener("change", event => {
  applyTheme(event.target.value);
  persistDeck();
});

input.addEventListener("input", () => {
  localStorage.setItem(STORAGE_KEY, input.value);
});

featureFlags.applyToDom(document);
initLocalState();
initAccount();
initCollab();

if (!slides.length) {
  slides = parseSlides(input.value);
  renderSlides();
  showCurrent();
}

if (slides.length) {
  persistDeck();
}

updateHistory();
renderComments(current);
