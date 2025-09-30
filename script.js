const input = document.getElementById("inputText");
const slidesEl = document.getElementById("slides");
const generateBtn = document.getElementById("generateBtn");
const presentBtn = document.getElementById("presentBtn");
const pdfBtn = document.getElementById("pdfBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const themeSelect = document.getElementById("themeSelect");

let slides = [];
let current = 0;

const STORAGE_KEY = "quick-slides-input";
input.value = localStorage.getItem(STORAGE_KEY) || input.value;
input.addEventListener("input", () => localStorage.setItem(STORAGE_KEY, input.value));

function parseSlides(text) {
  // Split on blank lines or lines that are exactly '---'
  const raw = text.split(/\n\s*\n|^\s*---\s*$/m).map(s => s.trim()).filter(Boolean);
  return raw.map(block => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    const title = lines.shift() || "";
    return { title, bullets: lines };
  });
}

function renderSlides() {
  const theme = themeSelect.value || "light";
  document.documentElement.dataset.theme = theme;
  slidesEl.innerHTML = "";
  slides.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "slide";
    const h = document.createElement("h2");
    h.textContent = s.title;
    card.appendChild(h);
    s.bullets.forEach(b => {
      const p = document.createElement("p");
      p.textContent = b;
      card.appendChild(p);
    });
    const n = document.createElement("div");
    n.className = "num";
    n.textContent = `${i + 1}/${slides.length}`;
    card.appendChild(n);
    slidesEl.appendChild(card);
  });
}

function startPresentation() {
  if (!slides.length) generate();
  document.documentElement.classList.add("present");
  current = 0;
  showCurrent();
}

function endPresentation() {
  document.documentElement.classList.remove("present");
}

function showCurrent() {
  const cards = [...document.querySelectorAll(".slide")];
  cards.forEach((c, i) => {
    c.style.display = (document.documentElement.classList.contains("present"))
      ? (i === current ? "flex" : "none")
      : "flex";
  });
}

function next() {
  if (current < slides.length - 1) { current++; showCurrent(); }
}
function prev() {
  if (current > 0) { current--; showCurrent(); }
}

function exportPDF() {
  // Use the browser print dialog. Print styles make one slide per page.
  window.print();
}

function applyTheme(name) {
  const allowed = ["light", "dark", "contrast", "clean"];
  const theme = allowed.includes(name) ? name : "light";
  themeSelect.value = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("quick-slides-theme", theme);
}

function generate() {
  slides = parseSlides(input.value);
  renderSlides();
  showCurrent();
}

generateBtn.addEventListener("click", generate);
presentBtn.addEventListener("click", () => {
  if (document.documentElement.classList.contains("present")) endPresentation();
  else startPresentation();
});
pdfBtn.addEventListener("click", exportPDF);
nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);
document.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
  if (e.key === "Escape") endPresentation();
});

themeSelect.value = localStorage.getItem("quick-slides-theme") || "light";
applyTheme(themeSelect.value);
themeSelect.addEventListener("change", e => {
  applyTheme(e.target.value);
  renderSlides();
  showCurrent();
});

// Initial render
generate();
