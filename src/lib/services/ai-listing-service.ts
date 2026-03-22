import { slugify, toneFromCondition } from "@/lib/utils";
import type { ListingAiInsights, ListingDraft, ListingDraftInput } from "@/lib/types";

type GeminiPart = {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
};

type PartialListingDraft = Partial<ListingDraft> & {
  aiInsights?: Partial<ListingAiInsights>;
};

export type DraftResult = {
  draft: ListingDraft;
  source: "gemini" | "fallback";
  statusMessage: string;
  clarificationNeeded?: string;
};

type HeroImageResult = {
  imageUrl: string | null;
  source: "gemini-image" | "seller-photo" | "fallback";
  statusMessage: string;
};

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

function inlinePartFromDataUrl(dataUrl: string): GeminiPart | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    inline_data: {
      mime_type: match[1],
      data: match[2],
    },
  };
}

function inferCategory(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (normalized.match(/quest|vr|playstation|xbox|gaming|gpu|graphics/)) {
    return "VR & Gaming";
  }

  if (normalized.match(/laptop|pc|monitor|keyboard|mouse|desktop/)) {
    return "Computers";
  }

  if (normalized.match(/ipad|tablet|pencil/)) {
    return "Tablets";
  }

  if (normalized.match(/camera|lens|sony|canon/)) {
    return "Cameras";
  }

  if (normalized.match(/phone|iphone|android|pixel|samsung|galaxy/)) {
    return "Phones";
  }

  return "Electronics";
}

function inferCondition(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (normalized.match(/mint|perfect|like new|excellent/)) {
    return "Excellent";
  }

  if (normalized.match(/very good|clean|light use/)) {
    return "Very Good";
  }

  if (normalized.match(/used|good|works well|bon etat/)) {
    return "Good";
  }

  return "Good";
}

function inferTitle(prompt: string, category: string) {
  const words = prompt
    .replace(/[^\w\s+]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  if (words.length === 0) {
    return `${category} Listing`;
  }

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function inferPrice(prompt: string, desiredPriceTon?: number) {
  if (desiredPriceTon && desiredPriceTon > 0) {
    return desiredPriceTon;
  }

  const normalized = prompt.toLowerCase();

  if (normalized.match(/iphone\s*15\s*pro\s*max/)) return 340;
  if (normalized.match(/iphone\s*15\s*pro/)) return 300;
  if (normalized.match(/iphone\s*14\s*pro\s*max/)) return 290;
  if (normalized.match(/iphone\s*14\s*pro/)) return 250;
  if (normalized.match(/iphone\s*14/)) return 220;
  if (normalized.match(/iphone\s*13/)) return 180;
  if (normalized.match(/galaxy\s*a80/)) return 70;
  if (normalized.match(/galaxy\s*s2[34]/)) return 240;
  if (normalized.match(/g502|logitech\s*g502/)) return 35;
  if (normalized.match(/g pro x superlight|superlight/)) return 80;
  if (normalized.match(/ps5|playstation\s*5/)) return 180;
  if (normalized.match(/quest\s*3/)) return 240;
  if (normalized.match(/quest\s*2/)) return 140;
  if (normalized.match(/ipad\s*pro/)) return 280;
  if (normalized.match(/macbook\s*pro/)) return 420;
  if (normalized.match(/laptop|pc|legion|macbook/)) return 390;
  if (normalized.match(/ipad|tablet/)) return 220;
  if (normalized.match(/mouse|souris/)) return 30;
  if (normalized.match(/quest|vr|gaming/)) return 150;
  if (normalized.match(/phone|iphone|pixel|galaxy/)) return 160;

  return 120;
}

function extractExplicitTonPrice(prompt: string) {
  const match = prompt.match(/(\d+(?:[.,]\d+)?)\s*ton\b/i);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function extractTags(prompt: string, category: string, city: string) {
  const normalizedWords = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 5);

  return Array.from(new Set([...normalizedWords, category.toLowerCase(), city.toLowerCase()])).slice(0, 6);
}

function rewriteFallbackSummary(prompt: string, title: string, city: string, condition: string) {
  const normalizedPrompt = prompt.trim().replace(/\s+/g, " ");

  return [
    `${title} offered in ${condition.toLowerCase()} condition for an in-person exchange.`,
    `Pickup or meetup is available in ${city}.`,
    `Seller notes: ${normalizedPrompt}.`,
    "Buyer can reserve the meetup first, inspect the item in person, and release payment only after validation.",
  ].join(" ");
}

function fallbackDraft(input: ListingDraftInput): DraftResult {
  const explicitPriceTon = input.desiredPriceTon ?? extractExplicitTonPrice(input.sellerPrompt);
  const category = inferCategory(input.sellerPrompt);
  const condition = inferCondition(input.sellerPrompt);
  const title = inferTitle(input.sellerPrompt, category);
  const priceTon = inferPrice(input.sellerPrompt, explicitPriceTon);
  const aiInsights: ListingAiInsights = {
    suggestedTitle: title,
    pricingRationale: explicitPriceTon
      ? `${toneFromCondition(condition)} Seller provided an explicit price of ${explicitPriceTon} TON.`
      : `${toneFromCondition(condition)} Fallback estimation based on the product model and category suggests around ${priceTon} TON.`,
    tags: extractTags(input.sellerPrompt, category, input.city),
  };

  return {
    draft: {
      title,
      summary: rewriteFallbackSummary(input.sellerPrompt, title, input.city, condition),
      category,
      condition,
      priceTon,
      aiInsights,
    },
    source: "fallback",
    statusMessage: explicitPriceTon
      ? "Gemini generation was unavailable, so fallback copy generation preserved the seller price."
      : "Gemini generation was unavailable, so fallback copy generation used a model-based estimate.",
  };
}

function extractJsonCandidate(content: string) {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);

  if (fencedMatch) {
    return fencedMatch[1];
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }

  return content;
}

async function fetchImageAsInlinePart(imageUrl: string): Promise<GeminiPart | null> {
  if (imageUrl.startsWith("data:image/")) {
    return inlinePartFromDataUrl(imageUrl);
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    return null;
  }

  const mimeType = response.headers.get("content-type") || "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    inline_data: {
      mime_type: mimeType,
      data: bytes.toString("base64"),
    },
  };
}

function buildDraftSchema() {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      category: { type: "string" },
      condition: { type: "string" },
      priceTon: { type: "number" },
      clarificationNeeded: { type: "string" },
      aiInsights: {
        type: "object",
        properties: {
          suggestedTitle: { type: "string" },
          pricingRationale: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  };
}

async function fetchGeminiWithRetry(url: string, body: unknown, apiKey: string) {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (response.status !== 429) {
      return response;
    }

    lastResponse = response;
    const retryAfter = Number(response.headers.get("retry-after") || "2");
    const waitMs = Number.isFinite(retryAfter) ? Math.max(retryAfter, 2) * 1000 : 2000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return lastResponse;
}

async function fetchWebContext(apiKey: string, sellerPrompt: string): Promise<string | null> {
  try {
    const query = `Current second-hand market price and key specifications for: ${sellerPrompt}`;
    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`,
      {
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
      },
      apiKey,
    );

    if (!response || !response.ok) return null;

    const payload = (await response.json()) as GeminiPayload;
    return payload.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim() || null;
  } catch {
    return null;
  }
}

function buildGeminiParts(input: ListingDraftInput, explicitPriceTon?: number, webContext?: string): GeminiPart[] {
  return [
    {
      text: [
        "You help sellers create Telegram-native second-hand electronics listings for a TON commerce assistant.",
        "Return JSON only.",
        "First identify the most likely brand and exact model from the seller photo and prompt.",
        "If the exact model is uncertain, infer the most likely brand and product family instead of using a generic title.",
        "Rewrite the description in polished marketplace language. Do not copy the seller sentence verbatim.",
        "Use the seller photo when present to identify the product and improve the listing.",
        explicitPriceTon
          ? `The seller explicitly set the price to ${explicitPriceTon} TON. Preserve that exact TON price.`
          : "The seller did not provide a TON price. Estimate a fair current second-hand TON price based primarily on the web research context above and the product's condition. Adjust downward from the new retail price according to condition (Excellent: ~75-85%, Very Good: ~60-75%, Good: ~45-60%, Fair: ~30-45%). If the exact model is uncertain, estimate from the closest matching product family and explain that logic in pricingRationale.",
        "Keep the tone concise, credible, and marketplace-ready.",
        "Prefer a title that starts with the identified brand and model whenever possible.",
        "If and only if the photo is too blurry to identify any product, OR the seller's city or location is completely absent from the prompt, set clarificationNeeded to one short, friendly question asking for that specific missing info. In all other cases leave clarificationNeeded empty.",
        webContext ? `Web research context (use this to improve accuracy of price and specs):\n${webContext}` : "",
        `Seller handle: ${input.sellerHandle}`,
        `City: ${input.city}`,
        `Seller prompt: ${input.sellerPrompt}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

function normalizeGeminiDraft(input: ListingDraftInput, parsed: PartialListingDraft): ListingDraft {
  const explicitPriceTon = input.desiredPriceTon ?? extractExplicitTonPrice(input.sellerPrompt);
  const category = typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim() : inferCategory(input.sellerPrompt);
  const condition = typeof parsed.condition === "string" && parsed.condition.trim() ? parsed.condition.trim() : inferCondition(input.sellerPrompt);
  const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : inferTitle(input.sellerPrompt, category);
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : rewriteFallbackSummary(input.sellerPrompt, title, input.city, condition);
  const geminiPrice = typeof parsed.priceTon === "number" && Number.isFinite(parsed.priceTon) ? parsed.priceTon : undefined;
  const priceTon = explicitPriceTon || geminiPrice || inferPrice(input.sellerPrompt, explicitPriceTon);
  const tags = Array.isArray(parsed.aiInsights?.tags)
    ? parsed.aiInsights.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())).slice(0, 6)
    : [];

  const pricingRationale =
    typeof parsed.aiInsights?.pricingRationale === "string" && parsed.aiInsights.pricingRationale.trim()
      ? parsed.aiInsights.pricingRationale.trim()
      : explicitPriceTon
        ? `${toneFromCondition(condition)} Seller provided an explicit price of ${explicitPriceTon} TON.`
        : `${toneFromCondition(condition)} Gemini identified the product and estimated around ${priceTon} TON based on the closest matching market comps.`;

  return {
    title,
    summary,
    category,
    condition,
    priceTon,
    aiInsights: {
      suggestedTitle:
        typeof parsed.aiInsights?.suggestedTitle === "string" && parsed.aiInsights.suggestedTitle.trim()
          ? parsed.aiInsights.suggestedTitle.trim()
          : title,
      pricingRationale,
      tags: tags.length > 0 ? tags : extractTags(`${title} ${input.sellerPrompt}`, category, input.city),
    },
  };
}

async function requestGeminiDraft(apiKey: string, input: ListingDraftInput, explicitPriceTon?: number) {
  const webContext = await fetchWebContext(apiKey, input.sellerPrompt);
  const parts = buildGeminiParts(input, explicitPriceTon, webContext ?? undefined);
  const imagePart = input.imageUrl ? await fetchImageAsInlinePart(input.imageUrl) : null;
  if (imagePart) {
    parts.push(imagePart);
  }

  return fetchGeminiWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`,
    {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: buildDraftSchema(),
      },
    },
    apiKey,
  );
}

function mergeWithFallbackDraft(input: ListingDraftInput, parsed: Partial<ListingDraft>): ListingDraft {
  const fallback = fallbackDraft(input).draft;
  const explicitPriceTon = input.desiredPriceTon ?? extractExplicitTonPrice(input.sellerPrompt);
  const title = parsed.title?.trim() || fallback.title;

  return {
    title,
    summary: parsed.summary?.trim() || fallback.summary,
    category: parsed.category?.trim() || fallback.category,
    condition: parsed.condition?.trim() || fallback.condition,
    priceTon: explicitPriceTon || Number(parsed.priceTon) || fallback.priceTon,
    aiInsights: {
      suggestedTitle: parsed.aiInsights?.suggestedTitle?.trim() || title,
      pricingRationale: parsed.aiInsights?.pricingRationale?.trim() || fallback.aiInsights.pricingRationale,
      tags: parsed.aiInsights?.tags?.slice(0, 6) || fallback.aiInsights.tags,
    },
  };
}

export async function generateListingDraftResult(input: ListingDraftInput): Promise<DraftResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = fallbackDraft(input);
    return {
      ...fallback,
      statusMessage: "Gemini API key is missing, so fallback copy generation was used.",
    };
  }

  const explicitPriceTon = input.desiredPriceTon ?? extractExplicitTonPrice(input.sellerPrompt);

  try {
    const response = await requestGeminiDraft(apiKey, input, explicitPriceTon);

    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      const body = response ? await response.text() : "No response";
      console.error("Gemini text generation failed:", body);
      const fallback = fallbackDraft(input);
      return {
        ...fallback,
        statusMessage:
          status === 429
            ? "Gemini text generation hit rate limits (HTTP 429), so fallback copy generation was used."
            : `Gemini text generation failed with HTTP ${status}, so fallback copy generation was used.`,
      };
    }

    const payload = (await response.json()) as GeminiPayload;
    const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();

    if (!content) {
      const fallback = fallbackDraft(input);
      return {
        ...fallback,
        statusMessage: "Gemini text generation returned no content, so fallback copy generation was used.",
      };
    }

    const rawJson = JSON.parse(extractJsonCandidate(content)) as Partial<ListingDraft> & { clarificationNeeded?: string };
    const clarificationNeeded =
      typeof rawJson.clarificationNeeded === "string" && rawJson.clarificationNeeded.trim()
        ? rawJson.clarificationNeeded.trim()
        : undefined;

    const parsed = mergeWithFallbackDraft(input, rawJson);
    const draft = normalizeGeminiDraft(input, parsed);

    return {
      draft,
      source: "gemini",
      clarificationNeeded,
      statusMessage: explicitPriceTon
        ? `Gemini text generation succeeded with ${GEMINI_TEXT_MODEL} while preserving the seller price.`
        : `Gemini text generation succeeded with ${GEMINI_TEXT_MODEL} using model-based price estimation.`,
    };
  } catch (error) {
    console.error("Gemini text generation threw an error:", error);
    const fallback = fallbackDraft(input);
    return {
      ...fallback,
      statusMessage: "Gemini text generation threw an error, so fallback copy generation was used.",
    };
  }
}

export async function generateListingHeroImageResult(input: ListingDraftInput, _draft: ListingDraft): Promise<HeroImageResult> {
  if (input.imageUrl) {
    return {
      imageUrl: input.imageUrl,
      source: "seller-photo",
      statusMessage: "Using the seller photo as the listing image.",
    };
  }

  return {
    imageUrl: null,
    source: "fallback",
    statusMessage: "No seller photo was available.",
  };
}

export async function generateListingDraft(input: ListingDraftInput) {
  return (await generateListingDraftResult(input)).draft;
}

export function createListingId(title: string) {
  return slugify(`${title}-${Date.now()}`);
}
