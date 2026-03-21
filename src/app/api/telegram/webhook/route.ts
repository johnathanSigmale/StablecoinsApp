import { NextResponse } from "next/server";

import { acquireRedisLock, hasRedisStore } from "@/lib/server/redis-store";
import { acceptMeetup, cancelListingEscrow, createListing, findListing } from "@/lib/services/listings-service";
import {
  answerTelegramCallbackQuery,
  buildContactUrl,
  buildListingUrl,
  buildTelegramShareUrl,
  sendTelegramBotMessage,
} from "@/lib/services/telegram-service";

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

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: TelegramMessage;
  from?: {
    username?: string;
  };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type SendRows = Parameters<typeof sendTelegramBotMessage>[2];

async function sendTelegramMessage(chatId: number, text: string, rows?: SendRows) {
  await sendTelegramBotMessage(chatId, text, rows);
}

function buildWelcomeMessage() {
  return [
    "Welcome to FlipBot AI.",
    "",
    "Send one plain-language message describing the item you want to sell.",
    "A seller photo is mandatory: send the image with the caption in the same message.",
    "Example: Selling my Meta Quest 2 with charger, very clean, meetup in Casablanca, 150 TON.",
    "",
    "I will generate a listing and reply with a link you can open and share.",
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

  if (isImageDocument(message?.document)) {
    const fileResult = await getTelegramFileDataUrl(message!.document!.file_id);
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

async function handleSellerCallback(callbackQuery: TelegramCallbackQuery) {
  const data = callbackQuery.data || "";
  const [action, listingId] = data.split(":");
  const chatId = callbackQuery.message?.chat?.id;

  if (!chatId || !listingId || !["seller_accept", "seller_cancel"].includes(action)) {
    await answerTelegramCallbackQuery(callbackQuery.id, "Unsupported seller action.");
    return NextResponse.json({ ok: true, ignored: true });
  }

  const listing = await findListing(listingId);
  if (!listing || listing.sellerTelegramChatId !== chatId) {
    await answerTelegramCallbackQuery(callbackQuery.id, "This action is not available for this chat.");
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const updatedListing =
      action === "seller_accept"
        ? await acceptMeetup(listingId)
        : await cancelListingEscrow(listingId, "Seller declined the meetup from Telegram.");

    if (!updatedListing) {
      await answerTelegramCallbackQuery(callbackQuery.id, "Listing not found.");
      return NextResponse.json({ ok: true, ignored: true });
    }

    const buyerContactUrl = buildContactUrl(updatedListing.escrow.buyerContact || updatedListing.escrow.buyer);
    await sendTelegramBotMessage(
      chatId,
      action === "seller_accept"
        ? [
            "Meetup accepted.",
            "",
            `Listing: ${updatedListing.title}`,
            `Buyer: ${updatedListing.escrow.buyer || "Unknown buyer"}`,
            updatedListing.escrow.buyerContact ? `Buyer contact: ${updatedListing.escrow.buyerContact}` : "",
            `Release code: ${updatedListing.escrow.releaseCode || "Pending"}`,
          ]
            .filter(Boolean)
            .join("\n")
        : [
            "Reservation cancelled.",
            "",
            `Listing: ${updatedListing.title}`,
            `Reason: ${updatedListing.escrow.cancellationReason || "Seller cancelled from Telegram."}`,
          ].join("\n"),
      [
        [{ text: "Open listing", url: buildListingUrl(updatedListing) }],
        ...(buyerContactUrl ? [[{ text: "Contact buyer", url: buyerContactUrl }]] : []),
      ],
    );

    await answerTelegramCallbackQuery(
      callbackQuery.id,
      action === "seller_accept" ? "Meetup accepted." : "Reservation cancelled.",
    );

    return NextResponse.json({ ok: true, action, listingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seller action failed.";
    await answerTelegramCallbackQuery(callbackQuery.id, message);
    return NextResponse.json({ ok: true, error: message });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as TelegramUpdate;

  if (payload.callback_query) {
    return handleSellerCallback(payload.callback_query);
  }

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
      await sendTelegramMessage(chatId, "Send a text description of the item you want to sell, or add a caption to the photo.");
    }
    return NextResponse.json({ ok: true, ignored: true, updateType });
  }

  if (prompt === "/start") {
    if (chatId) {
      await sendTelegramMessage(chatId, buildWelcomeMessage());
    }
    return NextResponse.json({ ok: true, started: true, updateType });
  }

  if (prompt.startsWith("/")) {
    if (chatId) {
      await sendTelegramMessage(chatId, "Unsupported command. Send a normal message that describes the item.");
    }
    return NextResponse.json({ ok: true, ignored: true, command: prompt, updateType });
  }

  try {
    const attachment = await getTelegramImageAttachment(message, updateType);

    if (!attachment.dataUrl) {
      if (chatId) {
        await sendTelegramMessage(
          chatId,
          [
            "A seller image is required before I can create the listing.",
            "Send one product photo with the caption in the same message, or use the mini app and paste an image URL.",
            "",
            `Attachment status: ${attachment.status}`,
          ].join("\n"),
        );
      }

      return NextResponse.json({ ok: true, imageRequired: true, attachmentStatus: attachment.status, updateType });
    }

    const listing = await createListing({
      sellerPrompt: prompt,
      sellerHandle: message?.from?.username ? `@${message.from.username}` : "@telegram_seller",
      sellerChatId: message?.chat?.id,
      city: message?.chat?.title || "Telegram community",
      imageUrl: attachment.dataUrl,
    });

    const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/listings/${listing.id}`;
    const shareUrl = buildTelegramShareUrl(listing);

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
          `Attachment status: ${attachment.status}`,
          listing.generation?.textStatusMessage ? `Text status: ${listing.generation.textStatusMessage}` : "",
          listing.generation?.imageStatusMessage ? `Image status: ${listing.generation.imageStatusMessage}` : "",
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
    }

    return NextResponse.json({
      ok: true,
      listingId: listing.id,
      nextStep: listingUrl,
      generation: listing.generation,
      attachmentStatus: attachment.status,
      updateType,
    });
  } catch (error) {
    console.error("Telegram listing creation failed:", error);

    if (chatId) {
      await sendTelegramMessage(
        chatId,
        "I could not create the listing. Check NEXT_PUBLIC_APP_URL, GEMINI_API_KEY, storage configuration, and deployment logs, then try again.",
      );
    }

    return NextResponse.json({ ok: false, error: "Listing creation failed.", updateType }, { status: 500 });
  }
}
