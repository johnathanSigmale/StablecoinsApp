import { NextResponse } from "next/server";

import { createListing } from "@/lib/services/listings-service";

type TelegramMessage = {
  caption?: string;
  text?: string;
  photo?: Array<{ file_id: string }>;
  from?: {
    username?: string;
  };
  chat?: {
    title?: string;
  };
};

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    message?: TelegramMessage;
  };

  const message = payload.message;
  const prompt = message?.caption || message?.text;

  if (!prompt) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const listing = await createListing({
    sellerPrompt: prompt,
    sellerHandle: message?.from?.username ? `@${message.from.username}` : "@telegram_seller",
    city: message?.chat?.title || "Telegram community",
  });

  return NextResponse.json({
    ok: true,
    listingId: listing.id,
    nextStep: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/listings/${listing.id}`,
  });
}
