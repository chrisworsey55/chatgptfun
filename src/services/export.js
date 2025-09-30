const MIME_TYPES = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  images: "application/zip",
};

const EXTENSIONS = {
  pdf: "pdf",
  pptx: "pptx",
  images: "zip",
};

const wasmHandlers = {
  pdf: wasmPdf,
  pptx: wasmPptx,
  images: wasmImages,
};

const pipelines = {
  cloud: simulateCloudPipeline,
  wasm: async options => {
    const handler = wasmHandlers[options.format];
    return handler(options);
  },
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createDeckManifest(deck) {
  return {
    id: deck.id,
    name: deck.name ?? "untitled-deck",
    theme: deck.theme,
    updatedAt: deck.updatedAt,
    slideCount: deck.slides.length,
    slides: deck.slides.map((slide, index) => ({
      index,
      title: slide.title,
      bulletCount: slide.bullets.length,
      notes: slide.notes ?? "",
    })),
  };
}

async function simulateCloudPipeline(options) {
  await delay(450);
  const manifest = createDeckManifest(options.deck);
  const payload = JSON.stringify({
    type: "deck-export",
    manifest,
    format: options.format,
    pipeline: options.pipeline,
    generatedAt: new Date().toISOString(),
  }, null, 2);
  const blob = new Blob([payload], { type: MIME_TYPES[options.format] });
  return {
    blob,
    filename: `${manifest.name}-${manifest.updatedAt}.${EXTENSIONS[options.format]}`,
    pipeline: options.pipeline,
    format: options.format,
  };
}

async function wasmPdf(options) {
  const manifest = createDeckManifest(options.deck);
  const body = manifest.slides
    .map(slide => [slide.title, "".padEnd(slide.title.length, "="), ...options.deck.slides[slide.index].bullets].join("\n"))
    .join("\n\n");
  const text = `Quick Slides PDF Export\nTheme: ${manifest.theme}\nSlides: ${manifest.slideCount}\n\n${body}`;
  const blob = new Blob([text], { type: MIME_TYPES.pdf });
  return {
    blob,
    filename: `${manifest.name}-${manifest.updatedAt}.pdf`,
    pipeline: options.pipeline,
    format: "pdf",
  };
}

async function wasmPptx(options) {
  const manifest = createDeckManifest(options.deck);
  const text = [
    "Quick Slides PowerPoint Export",
    `Theme: ${manifest.theme}`,
    `Slides: ${manifest.slideCount}`,
    "",
    ...manifest.slides.map(slide => `Slide ${slide.index + 1}: ${slide.title}`),
  ].join("\n");
  const blob = new Blob([text], { type: MIME_TYPES.pptx });
  return {
    blob,
    filename: `${manifest.name}-${manifest.updatedAt}.pptx`,
    pipeline: options.pipeline,
    format: "pptx",
  };
}

async function wasmImages(options) {
  const manifest = createDeckManifest(options.deck);
  const text = manifest.slides
    .map(slide => `Slide ${slide.index + 1}: ${slide.title} (${slide.bulletCount} bullets)`)
    .join("\n");
  const blob = new Blob([text], { type: MIME_TYPES.images });
  return {
    blob,
    filename: `${manifest.name}-${manifest.updatedAt}.zip`,
    pipeline: options.pipeline,
    format: "images",
  };
}

export function createExportService(defaults = {}) {
  const defaultPipeline = defaults.defaultPipeline ?? "wasm";
  async function exportDeck(options) {
    const pipeline = options.pipeline ?? defaultPipeline;
    const handler = pipelines[pipeline];
    if (!handler) {
      throw new Error(`Unsupported export pipeline: ${pipeline}`);
    }
    return handler({ ...options, pipeline });
  }

  async function download(result) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(result.blob);
    link.download = result.filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 0);
  }

  return {
    exportDeck,
    download,
  };
}
