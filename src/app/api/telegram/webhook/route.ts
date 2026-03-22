import { NextResponse } from "next/server";

import { getSellerProfile, upsertSellerProfile } from "@/lib/repository/seller-profiles-repository";
import { acquireRedisLock, hasRedisStore } from "@/lib/server/redis-store";
import { createListing } from "@/lib/services/listings-service";
import { buildTelegramShareUrl, sendTelegramBotMessage } from "@/lib/services/telegram-service";
import { isLikelyTonAddress } from "@/lib/utils";

type TelegramPhoto = {
  file_id: string;
  file_size?: number;
  width?: number;
  height?: number;
};

type TelegramDocument = {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramMessage = {
  message_id: number;
  caption?: string;
  text?: string;
  photo?: TelegramPhoto[];
  document?: TelegramDocument;
  from?: {
    username?: string;
  };
  chat?: {
    id: number;
    title?: string;
    type?: string;
  };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

type SendRows = Parameters<typeof sendTelegramBotMessage>[2];

async function sendTelegramMessage(chatId: number, text: string, rows?: SendRows) {
  await sendTelegramBotMessage(chatId, text, rows);
}

function buildWelcomeMessage() {
  return [
    "Welcome to FlipBot AI.",
    "",
    "1. Set your seller wallet first:",
    "/wallet <your TON testnet address>",
    "",
    "2. Then send one product photo with the caption in the same message.",
    "Example caption: Selling my Meta Quest 2 with charger, very clean, meetup in Casablanca, 150 TON.",
    "",
    "I will create the listing and return a shareable Telegram link.",
  ].join("\n");
}

function extractTelegramMessage(update: TelegramUpdate) {
  if (update.message) {
    return { message: update.message, updateType: "message" };
  }

  if (update.edited_message) {
    return { message: update.edited_message, updateType: "edited_message" };
  }

  if (update.channel_post) {
    return { message: update.channel_post, updateType: "channel_post" };
  }

  if (update.edited_channel_post) {
    return { message: update.edited_channel_post, updateType: "edited_channel_post" };
  }

  return { message: undefined, updateType: "unknown" };
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

function isImageDocument(document?: TelegramDocument | null) {
  if (!document) {
    return false;
  }

  if (document.mime_type?.startsWith("image/")) {
    return true;
  }

  return Boolean(document.file_name?.match(/\.(png|jpe?g|webp)$/i));
}

async function getTelegramFileDataUrl(fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { dataUrl: null, status: "Missing TELEGRAM_BOT_TOKEN." };
  }

  const fileInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!fileInfoResponse.ok) {
    return { dataUrl: null, status: `Telegram getFile failed with HTTP ${fileInfoResponse.status}.` };
  }

  const fileInfo = (await fileInfoResponse.json()) as {
    ok?: boolean;
    result?: {
      file_path?: string;
    };
  };

  const filePath = fileInfo.result?.file_path;
  if (!fileInfo.ok || !filePath) {
    return { dataUrl: null, status: "Telegram returned no downloadable file path." };
  }

  const fileResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileResponse.ok) {
    return { dataUrl: null, status: `Telegram file download failed with HTTP ${fileResponse.status}.` };
  }

  const headerMimeType = fileResponse.headers.get("content-type");
  const mimeType =
    headerMimeType && headerMimeType.startsWith("image/") ? headerMimeType : inferMimeTypeFromFilePath(filePath);

  const bytes = Buffer.from(await fileResponse.arrayBuffer());
  return {
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    status: "Seller photo was attached successfully.",
  };
}

function describeMessageShape(message?: TelegramMessage, updateType?: string) {
  if (!message) {
    return `Update type: ${updateType || "unknown"}. No supported Telegram message object was found.`;
  }

  const parts = [
    `Update type: ${updateType || "unknown"}`,
    `Chat type: ${message.chat?.type || "unknown"}`,
    `Has caption: ${message.caption ? "yes" : "no"}`,
    `Has text: ${message.text ? "yes" : "no"}`,
    `Photo count: ${message.photo?.length || 0}`,
    `Has document: ${message.document ? "yes" : "no"}`,
    message.document?.mime_type ? `Document mime: ${message.document.mime_type}` : "",
  ];

  return parts.filter(Boolean).join(" | ");
}

async function getTelegramImageAttachment(message?: TelegramMessage, updateType?: string) {
  const bestPhoto = getBestTelegramPhoto(message?.photo);
  if (bestPhoto) {
    const fileResult = await getTelegramFileDataUrl(bestPhoto.file_id);
    return {
      ...fileResult,
      status: `${fileResult.status} ${describeMessageShape(message, updateType)}`.trim(),
    };
  }

  if (message?.document && isImageDocument(message.document)) {
    const fileResult = await getTelegramFileDataUrl(message.document.file_id);
    return {
      ...fileResult,
      status: `${fileResult.status} ${describeMessageShape(message, updateType)}`.trim(),
    };
  }
  return {
    dataUrl: null,
    status: `No Telegram image attachment was detected. ${describeMessageShape(message, updateType)}`,
  };
}

function extractWalletCommand(prompt: string) {
  const match = prompt.match(/^\/wallet(?:@\w+)?\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function POST(request: Request) {
  const payload = (await request.json()) as TelegramUpdate;
  const { message, updateType } = extractTelegramMessage(payload);
  const chatId = message?.chat?.id;
  const prompt = (message?.caption || message?.text || "").trim();

  if (hasRedisStore() && message?.message_id) {
    const lockKey = `msg_lock:${message.chat?.id || "unknown"}:${message.message_id}`;
    const acquired = await acquireRedisLock(lockKey, 60);
    if (!acquired) {
      return NextResponse.json({ ok: true, duplicated: true, updateType });
    }
  }

  if (!prompt) {
    if (chatId) {
      await sendTelegramMessage(chatId, "Send a product photo with a caption, or use /wallet first to set your seller wallet.");
    }
    return NextResponse.json({ ok: true, ignored: true, updateType });
  }

  if (prompt === "/start") {
    if (chatId) {
      await sendTelegramMessage(chatId, buildWelcomeMessage());
    }
    return NextResponse.json({ ok: true, started: true, updateType });
  }

  if (prompt.startsWith("/wallet")) {
    if (!chatId) {
      return NextResponse.json({ ok: true, ignored: true, updateType });
    }

    const walletAddress = extractWalletCommand(prompt);
    if (!walletAddress) {
      await sendTelegramMessage(chatId, "Usage: /wallet <your TON testnet address>");
      return NextResponse.json({ ok: true, walletRequired: true, updateType });
    }

    if (!isLikelyTonAddress(walletAddress)) {
      await sendTelegramMessage(chatId, "This wallet address format does not look valid. Paste a TON wallet address and try again.");
      return NextResponse.json({ ok: true, invalidWallet: true, updateType });
    }

    const sellerHandle = message?.from?.username ? `@${message.from.username}` : undefined;
    await upsertSellerProfile({
      chatId,
      sellerHandle,
      walletAddress,
      updatedAt: new Date().toISOString(),
    });

    await sendTelegramMessage(
      chatId,
      [
        "Seller wallet saved.",
        `Wallet: ${walletAddress}`,
        "",
        "Next step: send a product photo with the caption in the same message to create a listing.",
      ].join("\n"),
    );

    return NextResponse.json({ ok: true, walletSaved: true, updateType });
  }

  if (prompt.startsWith("/profile")) {
    if (!chatId) {
      return NextResponse.json({ ok: true, ignored: true, updateType });
    }

    const profile = await getSellerProfile(chatId);
    await sendTelegramMessage(
      chatId,
      profile
        ? [
            "Seller profile",
            `Wallet: ${profile.walletAddress}`,
            `Handle: ${profile.sellerHandle || "not set"}`,
            "",
            "Send a product photo with caption to create a listing.",
          ].join("\n")
        : "No seller wallet is saved for this chat yet. Use /wallet <your TON testnet address> first.",
    );

    return NextResponse.json({ ok: true, profileShown: true, updateType });
  }

  if (prompt.startsWith("/")) {
    if (chatId) {
      await sendTelegramMessage(chatId, "Unsupported command. Use /wallet, /profile, or send a product photo with caption.");
    }
    return NextResponse.json({ ok: true, ignored: true, command: prompt, updateType });
  }

  try {
    if (!chatId) {
      return NextResponse.json({ ok: false, error: "Telegram chat id is required." }, { status: 400 });
    }

    const sellerProfile = await getSellerProfile(chatId);
    if (!sellerProfile?.walletAddress) {
      await sendTelegramMessage(
        chatId,
        "Set your seller wallet first with /wallet <your TON testnet address>, then send the product photo again.",
      );
      return NextResponse.json({ ok: true, walletRequired: true, updateType });
    }

    const attachment = await getTelegramImageAttachment(message, updateType);

    if (!attachment.dataUrl) {
      await sendTelegramMessage(
        chatId,
        [
          "A seller image is required before I can create the listing.",
          "Send one product photo with the caption in the same message.",
          "",
          `Attachment status: ${attachment.status}`,
        ].join("\n"),
      );

      return NextResponse.json({ ok: true, imageRequired: true, attachmentStatus: attachment.status, updateType });
    }

    const listing = await createListing({
      sellerPrompt: prompt,
      sellerHandle: message?.from?.username ? `@${message.from.username}` : sellerProfile.sellerHandle || "@telegram_seller",
      sellerChatId: chatId,
      sellerWalletAddress: sellerProfile.walletAddress,
      city: message?.chat?.title || "Telegram community",
      imageUrl: attachment.dataUrl,
    });

    const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/listings/${listing.id}`;
    const shareUrl = buildTelegramShareUrl(listing);

    await sendTelegramMessage(
      chatId,
      [
        "Listing created successfully.",
        "",
        `Item: ${listing.title}`,
        `Price: ${listing.priceTon} TON`,
        "",
        "Open and share this listing:",
        listingUrl,
      ]
        .filter(Boolean)
        .join("\n"),
      [
        [
          { text: "Open listing", url: listingUrl },
          { text: "Share in Telegram", url: shareUrl },
        ],
      ],
    );

    return NextResponse.json({
      ok: true,
      listingId: listing.id,
      nextStep: listingUrl,
      updateType,
    });
  } catch (error) {
    console.error("Telegram listing creation failed:", error);

    if (chatId) {
      await sendTelegramMessage(
        chatId,
        "I could not create the listing. Check NEXT_PUBLIC_APP_URL, GEMINI_API_KEY, storage configuration, seller wallet setup, and deployment logs, then try again.",
      );
    }

    return NextResponse.json({ ok: false, error: "Listing creation failed.", updateType }, { status: 500 });
  }
}


