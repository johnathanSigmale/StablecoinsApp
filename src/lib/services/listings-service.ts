import {
  createListingId,
  generateListingDraftResult,
  generateListingHeroImageResult,
} from "@/lib/services/ai-listing-service";
import { getListingById, readListings, writeListings } from "@/lib/repository/listings-repository";
import type { EscrowStatus, Listing, ListingDraftInput, PurchaseIntent } from "@/lib/types";

function nowIso() {
  return new Date().toISOString();
}

function normalizeEscrowStatus(status: string): EscrowStatus {
  if (status === "awaiting_release") {
    return "seller_accepted";
  }

  if (status === "funds_locked") {
    return "reserved_pending_seller";
  }

  return status as EscrowStatus;
}

function createReleaseCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function listListings() {
  const listings = await readListings();
  return listings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findListing(id: string) {
  return getListingById(id);
}

export async function createListing(input: ListingDraftInput) {
  const draftResult = await generateListingDraftResult(input);
  if (draftResult.source !== "gemini") {
    throw new Error(draftResult.statusMessage || "Gemini listing generation is required.");
  }
  const draft = draftResult.draft;
  const createdAt = nowIso();
  const imageResult = await generateListingHeroImageResult(input, draft);

  const listing: Listing = {
    id: createListingId(draft.title),
    title: draft.title,
    summary: draft.summary,
    category: draft.category,
    condition: draft.condition,
    priceTon: draft.priceTon,
    sellerHandle: input.sellerHandle,
    sellerTelegramChatId: input.sellerChatId,
    sellerWalletAddress: input.sellerWalletAddress,
    city: input.city,
    imageUrl:
      imageResult.imageUrl ||
      input.imageUrl ||
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    createdAt,
    status: "active",
    aiInsights: draft.aiInsights,
    generation: {
      textSource: draftResult.source,
      imageSource: imageResult.source,
      textStatusMessage: draftResult.statusMessage,
      imageStatusMessage: imageResult.statusMessage,
    },
    escrow: {
      status: "draft",
      buyer: null,
      lastUpdatedAt: createdAt,
    },
  };

  const listings = await readListings();
  listings.unshift(listing);
  await writeListings(listings);
  return listing;
}

export async function reserveListing(id: string, purchaseIntent: PurchaseIntent) {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === id);

  if (!listing) {
    return null;
  }

  if (listing.status !== "active") {
    throw new Error("Listing is no longer available.");
  }

  const nextTimestamp = nowIso();
  const buyerIdentity = purchaseIntent.buyerName?.trim() || purchaseIntent.buyerContact.trim();

  listing.status = "reserved";
  listing.escrow = {
    ...listing.escrow,
    status: "reserved_pending_seller",
    buyer: buyerIdentity,
    buyerContact: purchaseIntent.buyerContact.trim(),
    buyerWalletAddress: purchaseIntent.walletAddress?.trim(),
    reservationMode: purchaseIntent.reservationMode,
    releaseCode: createReleaseCode(),
    transactionRef: purchaseIntent.reservationMode === "balance_check" ? "balance-check-verified" : "demo-reservation",
    balanceVerifiedAt: purchaseIntent.reservationMode === "balance_check" ? nextTimestamp : undefined,
    fundsLockedAt: nextTimestamp,
    cancellationReason: undefined,
    cancelledAt: undefined,
    releasedAt: undefined,
    sellerAcceptedAt: undefined,
    lastUpdatedAt: nextTimestamp,
  };

  await writeListings(listings);
  return listing;
}

export async function acceptMeetup(id: string) {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === id);

  if (!listing) {
    return null;
  }

  const normalizedStatus = normalizeEscrowStatus(listing.escrow.status);
  if (normalizedStatus !== "reserved_pending_seller") {
    throw new Error("The listing must be reserved before the seller accepts the meetup.");
  }

  const nextTimestamp = nowIso();
  listing.status = "meetup";
  listing.escrow = {
    ...listing.escrow,
    status: "seller_accepted",
    sellerAcceptedAt: nextTimestamp,
    lastUpdatedAt: nextTimestamp,
  };

  await writeListings(listings);
  return listing;
}

export async function releaseListingEscrow(
  id: string,
  options?: {
    providedCode?: string;
    transactionRef?: string;
  },
) {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === id);

  if (!listing) {
    return null;
  }

  const normalizedStatus = normalizeEscrowStatus(listing.escrow.status);
  if (normalizedStatus !== "seller_accepted") {
    throw new Error("The seller must accept the meetup before the buyer can release payment.");
  }

  const expectedCode = listing.escrow.releaseCode?.trim().toUpperCase();
  const providedCode = options?.providedCode?.trim().toUpperCase();

  if (expectedCode && !providedCode) {
    throw new Error("The seller release code is required.");
  }

  if (expectedCode && providedCode !== expectedCode) {
    throw new Error("Release code does not match.");
  }

  if (listing.escrow.reservationMode === "balance_check" && !options?.transactionRef?.trim()) {
    throw new Error("A TON payment proof is required before the release can be finalized.");
  }

  const nextTimestamp = nowIso();
  listing.status = "sold";
  listing.escrow = {
    ...listing.escrow,
    status: "released",
    transactionRef: options?.transactionRef?.trim() || listing.escrow.transactionRef,
    releasedAt: nextTimestamp,
    lastUpdatedAt: nextTimestamp,
  };

  await writeListings(listings);
  return listing;
}

export async function cancelListingEscrow(id: string, reason?: string) {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === id);

  if (!listing) {
    return null;
  }

  const normalizedStatus = normalizeEscrowStatus(listing.escrow.status);
  if (!["reserved_pending_seller", "seller_accepted"].includes(normalizedStatus)) {
    throw new Error("Only a reserved meetup can be cancelled.");
  }

  const nextTimestamp = nowIso();
  listing.status = "active";
  listing.escrow = {
    status: "draft",
    buyer: null,
    buyerContact: undefined,
    buyerWalletAddress: undefined,
    reservationMode: undefined,
    releaseCode: undefined,
    transactionRef: undefined,
    balanceVerifiedAt: undefined,
    fundsLockedAt: undefined,
    sellerAcceptedAt: undefined,
    releasedAt: undefined,
    cancelledAt: nextTimestamp,
    cancellationReason: reason?.trim() || "Reservation was cancelled.",
    lastUpdatedAt: nextTimestamp,
  };

  await writeListings(listings);
  return listing;
}
