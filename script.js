const input = document.getElementById("inputText");
const slidesEl = document.getElementById("slides");
const generateBtn = document.getElementById("generateBtn");
const presentBtn = document.getElementById("presentBtn");
const pdfBtn = document.getElementById("pdfBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const themeSelect = document.getElementById("themeSelect");
const ratioSelect = document.getElementById("ratioSelect");
const progressFill = document.getElementById("progressFill");
const templatesBtn = document.getElementById("templatesBtn");
const templatesOverlay = document.getElementById("templatesOverlay");
const closeTemplatesBtn = document.getElementById("closeTemplatesBtn");
const copyTemplatesBtn = document.getElementById("copyTemplatesBtn");
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const brandPrimaryInput = document.getElementById("brandPrimary");
const brandAccentInput = document.getElementById("brandAccent");
const brandLogoInput = document.getElementById("brandLogo");

let slides = [];
let current = 0;
let previous = 0;

const STORAGE_KEYS = {
  content: "quick-slides-input",
  theme: "quick-slides-theme",
  ratio: "quick-slides-ratio",
  brand: "quick-slides-brand"
};

const TEMPLATE_SNIPPET = `# Hopkins Capital\n> AI-native private markets platform\n\n---\n::section\nWhy Now\n\n---\n# Problem\n- Manual, slow diligence\n- Disconnected data\n- Bandwidth bottlenecks\n\n---\n# Solution\n- Agents compress weeks to hours\n- Live KPIs and alerts\n- Judgment + automation\n\n---\n::two-col\nPlatform\n- CIM → IC in hours\n- VDR red flags\n- Portfolio KPIs\n|||\nEdge\n- Proprietary agents\n- Integrations\n- Design partner proof\n\n---\n::quote\n"He sees an exponential and bets aggressively."\n— Senior OpenAI leader\n\n---\n::image https://images.unsplash.com/photo-1520607162513-77705c0f0d4a\n# Design With Impact\n> Immersive, cinematic slides that persuade\n\n---\n# Call to Action\n- Pilot this quarter\n- Results in 30 days\n- chris@hopkins.capital`;

const storedContent = localStorage.getItem(STORAGE_KEYS.content);
if (storedContent) {
  input.value = storedContent;
}

function loadBrand() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.brand);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (err) {
    console.warn("Unable to parse brand settings", err);
    return null;
  }
}

function saveBrand(settings) {
  localStorage.setItem(STORAGE_KEYS.brand, JSON.stringify(settings));
}

const brandSettings = loadBrand() || {
  primary: brandPrimaryInput.value,
  accent: brandAccentInput.value,
  logo: ""
};

if (!brandSettings.primary) brandSettings.primary = brandPrimaryInput.value;
if (!brandSettings.accent) brandSettings.accent = brandAccentInput.value;
if (!brandSettings.logo) brandSettings.logo = "";

brandPrimaryInput.value = brandSettings.primary;
brandAccentInput.value = brandSettings.accent;
brandLogoInput.value = brandSettings.logo || "";
applyBrand(brandSettings);

const storedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "aurora";
applyTheme(storedTheme);
themeSelect.value = storedTheme;

const storedRatio = localStorage.getItem(STORAGE_KEYS.ratio) || "ratio-169";
applyRatio(storedRatio);
ratioSelect.value = storedRatio;

input.addEventListener("input", () => {
  localStorage.setItem(STORAGE_KEYS.content, input.value);
});

brandPrimaryInput.addEventListener("input", () => {
  brandSettings.primary = brandPrimaryInput.value;
  applyBrand(brandSettings);
  saveBrand(brandSettings);
});

brandAccentInput.addEventListener("input", () => {
  brandSettings.accent = brandAccentInput.value;
  applyBrand(brandSettings);
  saveBrand(brandSettings);
});

brandLogoInput.addEventListener("change", () => {
  brandSettings.logo = brandLogoInput.value.trim();
  applyBrand(brandSettings);
  saveBrand(brandSettings);
  generate();
});

themeSelect.addEventListener("change", event => {
  applyTheme(event.target.value);
  localStorage.setItem(STORAGE_KEYS.theme, event.target.value);
});

ratioSelect.addEventListener("change", event => {
  applyRatio(event.target.value);
  localStorage.setItem(STORAGE_KEYS.ratio, event.target.value);
  generate();
});

generateBtn.addEventListener("click", generate);
presentBtn.addEventListener("click", togglePresentation);
pdfBtn.addEventListener("click", () => window.print());
nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);

document.addEventListener("keydown", event => {
  if (!templatesOverlay.hidden && event.key === "Escape") {
    event.preventDefault();
    closeTemplates();
    return;
  }
  if (settingsPanel.classList.contains("open") && event.key === "Escape") {
    event.preventDefault();
    settingsPanel.classList.remove("open");
    settingsToggle.setAttribute("aria-expanded", "false");
    return;
  }
  if (document.documentElement.classList.contains("present")) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      endPresentation();
    }
  }
});

templatesBtn.addEventListener("click", () => openTemplates());
closeTemplatesBtn.addEventListener("click", () => closeTemplates());
templatesOverlay.addEventListener("click", event => {
  if (event.target === templatesOverlay) closeTemplates();
});
copyTemplatesBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(TEMPLATE_SNIPPET);
    copyTemplatesBtn.textContent = "Copied";
    setTimeout(() => (copyTemplatesBtn.textContent = "Copy examples"), 2000);
  } catch (err) {
    console.warn("Clipboard error", err);
  }
});

settingsToggle.addEventListener("click", () => {
  const isOpen = settingsPanel.classList.toggle("open");
  settingsToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    settingsPanel.focus({ preventScroll: true });
  }
});

function openTemplates() {
  templatesOverlay.hidden = false;
  document.body.classList.add("templates-open");
  templatesOverlay.querySelector(".templates-modal").focus({ preventScroll: true });
}

function closeTemplates() {
  templatesOverlay.hidden = true;
  document.body.classList.remove("templates-open");
  templatesBtn.focus({ preventScroll: true });
}

function applyBrand({ primary, accent }) {
  const root = document.documentElement;
  if (primary) root.style.setProperty("--brand-primary", primary);
  if (accent) root.style.setProperty("--brand-accent", accent);
}

function applyTheme(name) {
  const root = document.documentElement;
  ["theme-aurora", "theme-minimal", "theme-sunset", "theme-carbon"].forEach(cls =>
    root.classList.remove(cls)
  );
  root.classList.add(`theme-${name}`);
}

function applyRatio(ratioClass) {
  slidesEl.classList.remove("ratio-169", "ratio-43", "ratio-a4");
  slidesEl.classList.add(ratioClass);
}

function splitSlides(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let buffer = [];

  const flush = () => {
    while (buffer.length && !buffer[buffer.length - 1].trim()) buffer.pop();
    const hasContent = buffer.some(line => line.trim().length);
    if (hasContent) blocks.push(buffer.join("\n"));
    buffer = [];
  };

  lines.forEach(line => {
    if (/^\s*$/.test(line) || /^\s*---\s*$/.test(line)) {
      flush();
    } else {
      buffer.push(line);
    }
  });

  flush();
  return blocks;
}

function parseSlides(text) {
  const blocks = splitSlides(text);
  return blocks.map(block => parseBlock(block));
}

function parseBlock(block) {
  const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const slide = {
    type: "text",
    title: "",
    subtitle: "",
    bullets: [],
    paragraphs: [],
    columns: [],
    quote: "",
    author: "",
    image: "",
    raw: block
  };

  if (!lines.length) {
    slide.type = "text";
    return slide;
  }

  const templateMatch = lines[0].match(/^::([a-z-]+)(?:\s+(.*))?/i);
  if (templateMatch) {
    const template = templateMatch[1].toLowerCase();
    const arg = templateMatch[2]?.trim() || "";
    lines.shift();
    switch (template) {
      case "section": {
        slide.title = lines[0] || "";
        slide.type = "section";
        return slide;
      }
      case "quote": {
        if (!lines.length) break;
        const authorIndex = lines.findIndex(line => /^[—–-]/.test(line));
        if (authorIndex !== -1) {
          slide.author = lines.splice(authorIndex, 1)[0].replace(/^[—–-]\s*/, "").trim();
        }
        slide.quote = lines.join(" ").replace(/^"|"$/g, "").trim();
        slide.type = "quote";
        return slide;
      }
      case "image": {
        slide.image = arg;
        processStandardLines(lines, slide);
        slide.type = "image";
        return slide;
      }
      case "two-col": {
        const halves = [];
        let colBuffer = [];
        lines.forEach(line => {
          if (line === "|||") {
            halves.push(colBuffer);
            colBuffer = [];
          } else {
            colBuffer.push(line);
          }
        });
        halves.push(colBuffer);
        while (halves.length < 2) halves.push([]);
        slide.columns = halves.slice(0, 2).map(columnLines => buildColumn(columnLines));
        slide.type = "two-col";
        return slide;
      }
      default:
        break;
    }
  }

  processStandardLines(lines, slide);

  if (slide.bullets.length) {
    slide.type = "bullets";
  } else if (slide.subtitle || !slide.paragraphs.length) {
    slide.type = "title";
  } else {
    slide.type = "text";
  }

  return slide;
}

function buildColumn(lines) {
  const column = {
    title: "",
    bullets: [],
    paragraphs: []
  };
  if (!lines.length) return column;
  const localLines = [...lines];
  column.title = localLines.shift() || "";
  localLines.forEach(line => {
    if (/^[-*]\s+/.test(line)) {
      column.bullets.push(line.replace(/^[-*]\s+/, "").trim());
    } else if (line.length) {
      column.paragraphs.push(line);
    }
  });
  return column;
}

function processStandardLines(lines, slide) {
  const localLines = [...lines];
  localLines.forEach(line => {
    if (/^##\s+/.test(line)) {
      slide.paragraphs.push({ type: "subheading", text: line.replace(/^##\s+/, "").trim() });
    } else if (/^#\s+/.test(line) && !slide.title) {
      slide.title = line.replace(/^#\s+/, "").trim();
    } else if (/^>\s+/.test(line)) {
      const text = line.replace(/^>\s+/, "").trim();
      slide.subtitle = slide.subtitle ? `${slide.subtitle} ${text}` : text;
    } else if (/^[-*]\s+/.test(line)) {
      slide.bullets.push(line.replace(/^[-*]\s+/, "").trim());
    } else if (line.length) {
      slide.paragraphs.push({ type: "paragraph", text: line });
    }
  });

  if (!slide.title && slide.paragraphs.length) {
    const first = slide.paragraphs.shift();
    slide.title = first.text;
  }
}

function renderSlides() {
  slidesEl.innerHTML = "";
  slides.forEach((slide, index) => {
    const card = document.createElement("article");
    card.className = `slide type-${slide.type}`;
    if (slide.image) {
      card.style.setProperty("--image-url", `url(${slide.image})`);
    }
    const content = document.createElement("div");
    content.className = "content";

    if (slide.type === "section") {
      const heading = document.createElement("h2");
      heading.textContent = slide.title || "";
      content.appendChild(heading);
    } else if (slide.type === "quote") {
      const blockquote = document.createElement("blockquote");
      blockquote.textContent = slide.quote;
      content.appendChild(blockquote);
      if (slide.author) {
        const cite = document.createElement("cite");
        cite.textContent = `— ${slide.author}`;
        content.appendChild(cite);
      }
    } else if (slide.type === "two-col") {
      const columnsWrapper = document.createElement("div");
      columnsWrapper.className = "columns";
      slide.columns.forEach(col => {
        const columnEl = document.createElement("div");
        columnEl.className = "column";
        if (col.title) {
          const heading = document.createElement("h3");
          heading.textContent = col.title;
          columnEl.appendChild(heading);
        }
        if (col.bullets.length) {
          const list = document.createElement("ul");
          col.bullets.forEach(text => {
            const li = document.createElement("li");
            li.textContent = text;
            list.appendChild(li);
          });
          columnEl.appendChild(list);
        }
        col.paragraphs.forEach(text => {
          const p = document.createElement("p");
          p.textContent = text;
          columnEl.appendChild(p);
        });
        columnsWrapper.appendChild(columnEl);
      });
      content.appendChild(columnsWrapper);
    } else {
      if (slide.title) {
        const heading = document.createElement(slide.type === "title" ? "h1" : "h2");
        heading.textContent = slide.title;
        content.appendChild(heading);
      }
      if (slide.subtitle) {
        const subtitle = document.createElement("p");
        subtitle.className = "subtitle";
        subtitle.textContent = slide.subtitle;
        content.appendChild(subtitle);
      }
      if (slide.bullets.length) {
        const list = document.createElement("ul");
        list.className = "bullet-list";
        slide.bullets.forEach(text => {
          const li = document.createElement("li");
          li.textContent = text;
          list.appendChild(li);
        });
        content.appendChild(list);
      }
      slide.paragraphs.forEach(block => {
        if (block.type === "subheading") {
          const h3 = document.createElement("h3");
          h3.textContent = block.text;
          content.appendChild(h3);
        } else {
          const p = document.createElement("p");
          p.textContent = block.text;
          content.appendChild(p);
        }
      });
    }

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = `${index + 1}/${slides.length}`;
    card.appendChild(content);
    card.appendChild(num);

    if (brandSettings.logo) {
      const img = document.createElement("img");
      img.className = "logo";
      img.src = brandSettings.logo;
      img.alt = "Logo";
      card.appendChild(img);
    }

    slidesEl.appendChild(card);
  });
}

function togglePresentation() {
  if (document.documentElement.classList.contains("present")) {
    endPresentation();
  } else {
    startPresentation();
  }
  updatePresentButton();
}

function startPresentation() {
  if (!slides.length) generate();
  document.documentElement.classList.add("present");
  current = 0;
  previous = 0;
  showCurrent();
  updatePresentButton();
}

function endPresentation() {
  document.documentElement.classList.remove("present");
  showCurrent();
  updatePresentButton();
}

function next() {
  if (current < slides.length - 1) {
    previous = current;
    current += 1;
    showCurrent();
  }
}

function prev() {
  if (current > 0) {
    previous = current;
    current -= 1;
    showCurrent();
  }
}

function showCurrent() {
  const cards = Array.from(document.querySelectorAll(".slide"));
  if (!cards.length) {
    updateProgress(0);
    return;
  }

  if (document.documentElement.classList.contains("present")) {
    cards.forEach((card, index) => {
      if (index === current) {
        card.style.display = "flex";
        card.classList.remove("exit");
        void card.offsetWidth;
        card.classList.add("enter");
      } else {
        if (index === previous) {
          card.classList.remove("enter");
          void card.offsetWidth;
          card.classList.add("exit");
          setTimeout(() => {
            card.style.display = "none";
            card.classList.remove("exit");
          }, 350);
        } else {
          card.style.display = "none";
          card.classList.remove("enter", "exit");
        }
      }
    });
  } else {
    cards.forEach(card => {
      card.style.display = "flex";
      card.classList.remove("enter", "exit");
    });
  }
  updateProgress(slides.length ? ((current + 1) / slides.length) * 100 : 0);
}

function updateProgress(percent) {
  progressFill.style.width = `${percent}%`;
  progressFill.parentElement?.setAttribute("aria-valuenow", String(Math.round(percent)));
}

function updatePresentButton() {
  const active = document.documentElement.classList.contains("present");
  presentBtn.textContent = active ? "Exit" : "Present";
  presentBtn.setAttribute("aria-label", active ? "Exit presentation" : "Start presentation");
}

function generate() {
  slides = parseSlides(input.value || "");
  renderSlides();
  current = Math.min(current, Math.max(0, slides.length - 1));
  previous = current;
  showCurrent();
}

generate();
updatePresentButton();

window.addEventListener("beforeprint", () => {
  slidesEl.classList.add("printing");
});

window.addEventListener("afterprint", () => {
  slidesEl.classList.remove("printing");
});
