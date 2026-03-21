import { slugify, toneFromCondition } from "@/lib/utils";
import type { ListingAiInsights, ListingDraft, ListingDraftInput } from "@/lib/types";

type GeminiPart = {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
};

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

  if (normalized.match(/phone|iphone|android|pixel|samsung/)) {
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

  if (normalized.match(/used|good|works well/)) {
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

  if (normalized.match(/quest|vr/)) {
    return 150;
  }

  if (normalized.match(/phone|iphone|pixel/)) {
    return 260;
  }

  return 120;
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

function fallbackDraft(input: ListingDraftInput): ListingDraft {
  const category = inferCategory(input.sellerPrompt);
  const condition = inferCondition(input.sellerPrompt);
  const title = inferTitle(input.sellerPrompt, category);
  const priceTon = inferPrice(input.sellerPrompt, input.desiredPriceTon);
  const aiInsights: ListingAiInsights = {
    suggestedTitle: title,
    pricingRationale: `${toneFromCondition(condition)} Comparable listings in local Telegram groups should respond around ${priceTon} TON.`,
    tags: extractTags(input.sellerPrompt, category, input.city),
  };

  return {
    title,
    summary: `${input.sellerPrompt.trim()} Secure the meetup with TON escrow instead of cash and release funds after verification.`,
    category,
    condition,
    priceTon,
    aiInsights,
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

async function geminiDraft(input: ListingDraftInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const parts: GeminiPart[] = [
    {
      text: [
        "You help sellers create Telegram-native second-hand electronics listings for a TON commerce assistant.",
        "Return JSON only with keys: title, summary, category, condition, priceTon, aiInsights.",
        "aiInsights must contain suggestedTitle, pricingRationale, and tags.",
        `Seller handle: ${input.sellerHandle}`,
        `City: ${input.city}`,
        input.desiredPriceTon ? `Preferred price TON: ${input.desiredPriceTon}` : "Preferred price TON: none",
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
    return null;
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
    return null;
  }

  try {
    const parsed = JSON.parse(extractJsonCandidate(content)) as ListingDraft;
    if (!parsed.title || !parsed.summary || !parsed.category || !parsed.condition || !parsed.aiInsights) {
      return null;
    }

    parsed.priceTon = Number(parsed.priceTon) || inferPrice(input.sellerPrompt, input.desiredPriceTon);
    parsed.aiInsights.tags = parsed.aiInsights.tags?.slice(0, 6) || [];
    return parsed;
  } catch {
    return null;
  }
}

export async function generateListingDraft(input: ListingDraftInput) {
  return (await geminiDraft(input)) ?? fallbackDraft(input);
}

export function createListingId(title: string) {
  return slugify(`${title}-${Date.now()}`);
}
