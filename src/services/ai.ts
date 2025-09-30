export interface SlideSuggestion {
  title: string;
  bullets: string[];
  rationale: string;
}

export interface ToneOptions {
  tone: "formal" | "casual" | "inspirational" | "technical";
}

export interface DraftOptions {
  prompt: string;
  slides?: number;
}

const DEFAULT_TITLES = [
  "Vision",
  "Opportunity",
  "Solution",
  "Roadmap",
  "Metrics",
  "Call to action",
];

const TONE_TRANSFORMS: Record<ToneOptions["tone"], (value: string) => string> = {
  formal: value => value
    .replace(/\bcan't\b/gi, "cannot")
    .replace(/\bwon't\b/gi, "will not")
    .replace(/\blet's\b/gi, "let us"),
  casual: value => value
    .replace(/\butilize\b/gi, "use")
    .replace(/\bdemonstrate\b/gi, "show"),
  inspirational: value => `✨ ${value.replace(/(^|\.)\s*/g, sentence => sentence ? `${sentence.trim()} ` : "")}Keep pushing forward!`,
  technical: value => value.replace(/\bsolve\b/gi, "address").replace(/\bhelp\b/gi, "enable"),
};

function chunkParagraphs(input: string) {
  return input
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function titleFromPrompt(prompt: string, index: number) {
  const sentences = prompt.split(/[.!?]/).map(p => p.trim()).filter(Boolean);
  if (sentences[index]) {
    return sentences[index].split(/\s+/).slice(0, 5).join(" ");
  }
  return DEFAULT_TITLES[index % DEFAULT_TITLES.length];
}

function bulletize(text: string) {
  if (!text.includes(" ")) {
    return [text];
  }
  const parts = text.split(/[,;]\s*/).filter(Boolean);
  if (parts.length > 1) return parts;
  return text.split(/\.\s+/).map(part => part.trim()).filter(Boolean);
}

export class AiService {
  async draftSlides(options: DraftOptions): Promise<SlideSuggestion[]> {
    const chunks = chunkParagraphs(options.prompt);
    const slideCount = options.slides ?? Math.max(3, Math.min(6, chunks.length));
    if (!chunks.length) return [];
    const suggestions: SlideSuggestion[] = [];
    for (let i = 0; i < slideCount; i += 1) {
      const chunk = chunks[i % chunks.length];
      suggestions.push({
        title: titleFromPrompt(options.prompt, i),
        bullets: bulletize(chunk),
        rationale: `Derived from prompt section ${i % chunks.length + 1}.`,
      });
    }
    return suggestions;
  }

  adjustTone(slides: SlideSuggestion[], options: ToneOptions) {
    const transform = TONE_TRANSFORMS[options.tone];
    return slides.map(slide => ({
      ...slide,
      bullets: slide.bullets.map(transform),
    }));
  }

  suggestSlide(slides: SlideSuggestion[], topic: string): SlideSuggestion {
    const title = topic
      ? topic.replace(/(^|\s)\w/g, letter => letter.toUpperCase())
      : "Next steps";
    const rationale = `Suggested to deepen coverage of ${topic || "open topics"}.`;
    const bullets = [
      `Highlight the impact of ${topic || "this initiative"}.`,
      `Clarify owner and next milestone for ${topic || "the team"}.`,
      "Outline supporting data needed.",
    ];
    const seenTitles = new Set(slides.map(slide => slide.title.toLowerCase()));
    let uniqueTitle = title;
    let counter = 2;
    while (seenTitles.has(uniqueTitle.toLowerCase())) {
      uniqueTitle = `${title} (${counter})`;
      counter += 1;
    }
    return { title: uniqueTitle, bullets, rationale };
  }
}
