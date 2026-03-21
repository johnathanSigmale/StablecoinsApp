import { slugify, toneFromCondition } from "@/lib/utils";
import type { ListingAiInsights, ListingDraft, ListingDraftInput } from "@/lib/types";

type GeminiPart = {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
};

type GeminiResponsePart = {
  text?: string;
  inline_data?: {
    mime_type?: string;
    data?: string;
  };
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
};

type DraftResult = {
  draft: ListingDraft;
  source: "gemini" | "fallback";
  statusMessage: string;
};

type HeroImageResult = {
  imageUrl: string | null;
  source: "gemini-image" | "seller-photo" | "fallback";
  statusMessage: string;
};

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash-lite";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

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

  if (normalized.match(/used|good|works well|bon etat|bon état/)) {
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

  if (normalized.match(/iphone\s*15\s*pro\s*max/)) {
    return 340;
  }

  if (normalized.match(/iphone\s*15\s*pro/)) {
    return 300;
  }

  if (normalized.match(/iphone\s*14\s*pro\s*max/)) {
    return 290;
  }

  if (normalized.match(/iphone\s*14\s*pro/)) {
    return 250;
  }

  if (normalized.match(/iphone\s*14/)) {
    return 220;
  }

  if (normalized.match(/galaxy\s*a80/)) {
    return 70;
  }

  if (normalized.match(/galaxy\s*s2[34]/)) {
    return 240;
  }

  if (normalized.match(/ps5|playstation\s*5/)) {
    return 180;
  }

  if (normalized.match(/quest\s*3/)) {
    return 240;
  }

  if (normalized.match(/quest\s*2/)) {
    return 140;
  }

  if (normalized.match(/ipad\s*pro/)) {
    return 280;
  }

  if (normalized.match(/macbook\s*pro/)) {
    return 420;
  }

  if (normalized.match(/laptop|pc|legion|macbook/)) {
    return 390;
  }

  if (normalized.match(/ipad|tablet/)) {
    return 220;
  }

  if (normalized.match(/quest|vr|gaming/)) {
    return 150;
  }

  if (normalized.match(/phone|iphone|pixel|galaxy/)) {
    return 160;
  }

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
    "Buyer can lock TON first, inspect the item in person, and release funds only after validation.",
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
        required: ["suggestedTitle", "pricingRationale", "tags"],
      },
    },
    required: ["title", "summary", "category", "condition", "priceTon", "aiInsights"],
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
  const shouldEstimatePrice = !explicitPriceTon;
  const parts: GeminiPart[] = [
    {
      text: [
        "You help sellers create Telegram-native second-hand electronics listings for a TON commerce assistant.",
        "Return JSON only.",
        "Rewrite the description in polished marketplace language. Do not copy the seller sentence verbatim.",
        "Use the seller photo when present to identify the exact product model and improve the listing.",
        explicitPriceTon
          ? `The seller explicitly set the price to ${explicitPriceTon} TON. Preserve that exact TON price.`
          : "The seller did not provide a TON price. Estimate a fair current second-hand TON price for the exact product model. Do not use a canned category default.",
        "Keep the tone concise, credible, and marketplace-ready.",
        `Seller handle: ${input.sellerHandle}`,
        `City: ${input.city}`,
        `Seller prompt: ${input.sellerPrompt}`,
      ].join("\n"),
    },
  ];

  if (input.imageUrl) {
    const imagePart = await fetchImageAsInlinePart(input.imageUrl);
    if (imagePart) {
      parts.push(imagePart);
    }
  }

  try {
    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`,
      {
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: buildDraftSchema(),
        },
        tools: shouldEstimatePrice ? [{ google_search: {} }] : undefined,
      },
      apiKey,
    );

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

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        groundingMetadata?: {
          webSearchQueries?: string[];
          groundingChunks?: unknown[];
        };
      }>;
    };

    const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!content) {
      const fallback = fallbackDraft(input);
      return {
        ...fallback,
        statusMessage: "Gemini text generation returned no content, so fallback copy generation was used.",
      };
    }

    const parsed = JSON.parse(extractJsonCandidate(content)) as ListingDraft;
    if (!parsed.title || !parsed.summary || !parsed.category || !parsed.condition || !parsed.aiInsights) {
      const fallback = fallbackDraft(input);
      return {
        ...fallback,
        statusMessage: "Gemini text generation returned incomplete structured data, so fallback copy generation was used.",
      };
    }

    const usedSearchGrounding = Boolean(
      payload.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ||
        payload.candidates?.[0]?.groundingMetadata?.groundingChunks?.length,
    );

    parsed.priceTon = explicitPriceTon || Number(parsed.priceTon) || inferPrice(input.sellerPrompt, explicitPriceTon);
    parsed.aiInsights.tags = parsed.aiInsights.tags?.slice(0, 6) || [];

    if (!explicitPriceTon && !parsed.aiInsights.pricingRationale) {
      parsed.aiInsights.pricingRationale = `AI-estimated market price for the product is about ${parsed.priceTon} TON.`;
    }

    return {
      draft: parsed,
      source: "gemini",
      statusMessage: explicitPriceTon
        ? `Gemini text generation succeeded with ${GEMINI_TEXT_MODEL} while preserving the seller price.`
        : usedSearchGrounding
          ? `Gemini text generation succeeded with ${GEMINI_TEXT_MODEL} using Google Search grounding for price estimation.`
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

function extractInlineImagePart(parts: GeminiResponsePart[]) {
  for (const part of parts) {
    const snakeInline = part.inline_data;
    const camelInline = part.inlineData;
    const mimeType = snakeInline?.mime_type || camelInline?.mimeType;
    const data = snakeInline?.data || camelInline?.data;

    if (mimeType?.startsWith("image/") && data) {
      return `data:${mimeType};base64,${data}`;
    }
  }

  return null;
}

export async function generateListingHeroImageResult(input: ListingDraftInput, draft: ListingDraft): Promise<HeroImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      imageUrl: input.imageUrl || null,
      source: input.imageUrl ? "seller-photo" : "fallback",
      statusMessage: input.imageUrl
        ? "Using the seller photo because Gemini image generation is unavailable."
        : "No seller photo and no Gemini image generation available.",
    };
  }

  const parts: GeminiPart[] = [
    {
      text: [
        `Create a clean ecommerce hero image for this product: ${draft.title}.`,
        `Category: ${draft.category}.`,
        `Condition: ${draft.condition}.`,
        "Style: photorealistic product shot, centered subject, premium studio lighting, realistic materials, no text, no watermark, no collage.",
        input.imageUrl
          ? "Use the reference image to preserve the exact identity, color, and shape of the seller's real product."
          : "Generate the product image from the description only.",
        `Seller description: ${input.sellerPrompt}`,
      ].join("\n"),
    },
  ];

  if (input.imageUrl) {
    const imagePart = await fetchImageAsInlinePart(input.imageUrl);
    if (imagePart) {
      parts.push(imagePart);
    }
  }

  try {
    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
      {
        contents: [{ parts }],
      },
      apiKey,
    );

    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      const body = response ? await response.text() : "No response";
      console.error("Gemini image generation failed:", body);

      if (status === 429 && input.imageUrl) {
        return {
          imageUrl: input.imageUrl,
          source: "seller-photo",
          statusMessage: "Gemini image generation hit rate limits (HTTP 429), so the seller photo is used instead.",
        };
      }
    } else {
      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: GeminiResponsePart[];
          };
        }>;
      };

      const imageDataUrl = extractInlineImagePart(payload.candidates?.[0]?.content?.parts || []);
      if (imageDataUrl) {
        return {
          imageUrl: imageDataUrl,
          source: "gemini-image",
          statusMessage: `Gemini generated a hero image successfully with ${GEMINI_IMAGE_MODEL}.`,
        };
      }

      console.error("Gemini image generation returned no inline image part.");
    }
  } catch (error) {
    console.error("Gemini image generation threw an error:", error);
  }

  if (input.imageUrl) {
    return {
      imageUrl: input.imageUrl,
      source: "seller-photo",
      statusMessage: "Gemini image generation failed, so the seller photo is used instead.",
    };
  }

  return {
    imageUrl: null,
    source: "fallback",
    statusMessage: "Gemini image generation failed and no seller photo was available.",
  };
}

export async function generateListingDraft(input: ListingDraftInput) {
  return (await generateListingDraftResult(input)).draft;
}

export function createListingId(title: string) {
  return slugify(`${title}-${Date.now()}`);
}
