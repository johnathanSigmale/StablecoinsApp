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

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function inferPrice(prompt: string, desiredPriceTon?: number) {
  if (desiredPriceTon && desiredPriceTon > 0) {
    return desiredPriceTon;
  }

  const normalized = prompt.toLowerCase();

  if (normalized.match(/laptop|pc|legion|macbook/)) {
    return 390;
  }

  if (normalized.match(/ipad|tablet/)) {
    return 220;
  }

  if (normalized.match(/quest|vr|ps5|playstation/)) {
    return 150;
  }

  if (normalized.match(/phone|iphone|pixel|galaxy/)) {
    return 260;
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
  return [
    `${title} offered in ${condition.toLowerCase()} condition.`,
    `Local handoff available in ${city}.`,
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
    pricingRationale: `${toneFromCondition(condition)} Comparable listings in local Telegram groups should respond around ${priceTon} TON.`,
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
    statusMessage: "Gemini text generation failed, so fallback copy generation was used.",
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

export async function generateListingDraftResult(input: ListingDraftInput): Promise<DraftResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackDraft(input);
  }

  const explicitPriceTon = input.desiredPriceTon ?? extractExplicitTonPrice(input.sellerPrompt);

  const parts: GeminiPart[] = [
    {
      text: [
        "You help sellers create Telegram-native second-hand electronics listings for a TON commerce assistant.",
        "Return strict JSON only with keys: title, summary, category, condition, priceTon, aiInsights.",
        "aiInsights must contain suggestedTitle, pricingRationale, and tags.",
        "Rewrite the description in polished marketplace language. Do not copy the seller sentence verbatim.",
        "Use the provided image when it is present to infer the actual product and avoid generic wording.",
        "If the seller explicitly provided a TON price, preserve that exact TON price in the output.",
        `Seller handle: ${input.sellerHandle}`,
        `City: ${input.city}`,
        explicitPriceTon ? `Preferred price TON: ${explicitPriceTon}` : "Preferred price TON: none",
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
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("Gemini text generation failed:", body);
      return fallbackDraft(input);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!content) {
      return fallbackDraft(input);
    }

    const parsed = JSON.parse(extractJsonCandidate(content)) as ListingDraft;
    if (!parsed.title || !parsed.summary || !parsed.category || !parsed.condition || !parsed.aiInsights) {
      return fallbackDraft(input);
    }

    parsed.priceTon = explicitPriceTon || Number(parsed.priceTon) || inferPrice(input.sellerPrompt, explicitPriceTon);
    parsed.aiInsights.tags = parsed.aiInsights.tags?.slice(0, 6) || [];

    return {
      draft: parsed,
      source: "gemini",
      statusMessage: "Gemini text generation succeeded.",
    };
  } catch (error) {
    console.error("Gemini text generation threw an error:", error);
    return fallbackDraft(input);
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

  const prompt = [
    `Create a clean marketplace hero image for this product: ${draft.title}.`,
    `Category: ${draft.category}.`,
    `Condition: ${draft.condition}.`,
    "Style: photorealistic ecommerce product shot, centered subject, neutral dark background, studio lighting, premium but realistic, no text, no watermark, no collage.",
    input.imageUrl ? "Use the reference image to preserve the exact product identity while improving presentation." : "Generate the product image from the listing description alone.",
    `Seller description: ${input.sellerPrompt}`,
  ].join("\n");

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3-pro-image-preview",
        input: prompt,
        response_modalities: ["IMAGE"],
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        outputs?: Array<{
          type?: string;
          mime_type?: string;
          data?: string;
        }>;
      };

      const imageOutput = payload.outputs?.find((output) => output.type === "image" && output.mime_type?.startsWith("image/") && output.data);
      if (imageOutput?.mime_type && imageOutput.data) {
        return {
          imageUrl: `data:${imageOutput.mime_type};base64,${imageOutput.data}`,
          source: "gemini-image",
          statusMessage: "Gemini generated a hero image successfully.",
        };
      }
    } else {
      const body = await response.text();
      console.error("Gemini image generation failed:", body);
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
