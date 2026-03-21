import { NextResponse } from "next/server";

import { createListing } from "@/lib/services/listings-service";

type TelegramMessage = {
  caption?: string;
  text?: string;
  photo?: Array<{ file_id: string }>;
  from?: {
    username?: string;
  };
  chat: {
    id: number;
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

  // Envoi de la réponse au bot Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/listings/${listing.id}`;
  
  if (botToken && payload.message?.chat.id) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: payload.message.chat.id,
          text: `✅ Annonce créée avec succès !\n\n📦 *${listing.title}*\n💰 Prix: ${listing.priceTon} TON\n\nTu peux la voir et la partager ici :\n${listingUrl}`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💎 Voir l'annonce", url: listingUrl }]
            ]
          }
        }),
      });
    } catch (error) {
      console.error("Failed to send Telegram message:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    listingId: listing.id,
    nextStep: listingUrl,
  });
}
