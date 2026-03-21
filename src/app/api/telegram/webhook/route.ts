import { NextResponse } from "next/server";

import { acquireRedisLock, hasRedisStore } from "@/lib/server/redis-store";
import { createListing } from "@/lib/services/listings-service";

type TelegramPhoto = {
  file_id: string;
  file_size?: number;
  width?: number;
  height?: number;
};

type TelegramMessage = {
  message_id: number;
  caption?: string;
  text?: string;
  photo?: TelegramPhoto[];
  from?: {
    username?: string;
  };
  chat?: {
    id: number;
    title?: string;
  };
};

async function sendTelegramMessage(chatId: number, text: string, listingUrl?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return;
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: listingUrl
        ? {
            inline_keyboard: [[{ text: "Open listing", url: listingUrl }]],
          }
        : undefined,
    }),
  });
}

function buildWelcomeMessage() {
  return [
    "Welcome to FlipBot AI.",
    "",
    "Send one plain-language message describing the item you want to sell.",
    "You can also send a photo with a caption.",
    "Example: Selling my Meta Quest 2 with charger, very clean, meetup in Casablanca, 150 TON.",
    "",
    "I will generate a listing and reply with a link you can open and share.",
  ].join("\n");
}

function getBestTelegramPhoto(photos?: TelegramPhoto[]) {
  if (!photos || photos.length === 0) {
    return null;
  }

  return [...photos].sort((left, right) => (right.file_size || 0) - (left.file_size || 0))[0];
}

function inferMimeTypeFromFilePath(filePath: string) {
  const normalized = filePath.toLowerCase();

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

async function getTelegramPhotoDataUrl(fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return null;
  }

  const fileInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!fileInfoResponse.ok) {
    return null;
  }

  const fileInfo = (await fileInfoResponse.json()) as {
    ok?: boolean;
    result?: {
      file_path?: string;
    };
  };

  const filePath = fileInfo.result?.file_path;
  if (!fileInfo.ok || !filePath) {
    return null;
  }

  const fileResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileResponse.ok) {
    return null;
  }

  const headerMimeType = fileResponse.headers.get("content-type");
  const mimeType =
    headerMimeType && headerMimeType.startsWith("image/") ? headerMimeType : inferMimeTypeFromFilePath(filePath);

  const bytes = Buffer.from(await fileResponse.arrayBuffer());
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    message?: TelegramMessage;
  };

  const message = payload.message;
  const chatId = message?.chat?.id;
  const prompt = (message?.caption || message?.text || "").trim();

  if (hasRedisStore() && message?.message_id) {
    const lockKey = `msg_lock:${message.chat?.id || "unknown"}:${message.message_id}`;
    const acquired = await acquireRedisLock(lockKey, 60);
    if (!acquired) {
      return NextResponse.json({ ok: true, duplicated: true });
    }
  }

  if (!prompt) {
    if (chatId) {
      await sendTelegramMessage(chatId, "Send a text description of the item you want to sell, or add a caption to the photo.");
    }
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (prompt === "/start") {
    if (chatId) {
      await sendTelegramMessage(chatId, buildWelcomeMessage());
    }
    return NextResponse.json({ ok: true, started: true });
  }

  if (prompt.startsWith("/")) {
    if (chatId) {
      await sendTelegramMessage(chatId, "Unsupported command. Send a normal message that describes the item.");
    }
    return NextResponse.json({ ok: true, ignored: true, command: prompt });
  }

  try {
    const bestPhoto = getBestTelegramPhoto(message?.photo);
    const photoDataUrl = bestPhoto ? await getTelegramPhotoDataUrl(bestPhoto.file_id) : undefined;

    const listing = await createListing({
      sellerPrompt: prompt,
      sellerHandle: message?.from?.username ? `@${message.from.username}` : "@telegram_seller",
      city: message?.chat?.title || "Telegram community",
      imageUrl: photoDataUrl || undefined,
    });

    const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/listings/${listing.id}`;

    if (chatId) {
      await sendTelegramMessage(
        chatId,
        [
          "Listing created successfully.",
          "",
          `Item: ${listing.title}`,
          `Price: ${listing.priceTon} TON`,
          `Text source: ${listing.generation?.textSource || "unknown"}`,
          `Image source: ${listing.generation?.imageSource || "unknown"}`,
          listing.generation?.textStatusMessage ? `Text status: ${listing.generation.textStatusMessage}` : "",
          listing.generation?.imageStatusMessage ? `Image status: ${listing.generation.imageStatusMessage}` : "",
          "",
          "Open and share this listing:",
          listingUrl,
        ]
          .filter(Boolean)
          .join("\n"),
        listingUrl,
      );
    }

    return NextResponse.json({
      ok: true,
      listingId: listing.id,
      nextStep: listingUrl,
      generation: listing.generation,
    });
  } catch (error) {
    console.error("Telegram listing creation failed:", error);

    if (chatId) {
      await sendTelegramMessage(
        chatId,
        "I could not create the listing. Check NEXT_PUBLIC_APP_URL, GEMINI_API_KEY, storage configuration, and deployment logs, then try again.",
      );
    }

    return NextResponse.json({ ok: false, error: "Listing creation failed." }, { status: 500 });
  }
}
