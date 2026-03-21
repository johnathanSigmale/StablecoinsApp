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

  return status as EscrowStatus;
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
    status: "funds_locked",
    buyer: buyerIdentity,
    buyerContact: purchaseIntent.buyerContact.trim(),
    buyerWalletAddress: purchaseIntent.walletAddress,
    releaseCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    transactionRef: purchaseIntent.walletAddress || "demo-simulation",
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
  if (normalizedStatus !== "funds_locked") {
    throw new Error("Funds must be locked before the seller accepts the meetup.");
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

export async function releaseListingEscrow(id: string, providedCode?: string) {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === id);

  if (!listing) {
    return null;
  }

  const normalizedStatus = normalizeEscrowStatus(listing.escrow.status);
  if (normalizedStatus !== "seller_accepted") {
    throw new Error("The seller must accept the meetup before the buyer releases funds.");
  }

  if (listing.escrow.releaseCode && providedCode && listing.escrow.releaseCode !== providedCode.trim().toUpperCase()) {
    throw new Error("Release code does not match.");
  }

  const nextTimestamp = nowIso();
  listing.status = "sold";
  listing.escrow = {
    ...listing.escrow,
    status: "released",
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
  if (!["funds_locked", "seller_accepted"].includes(normalizedStatus)) {
    throw new Error("Only a reserved meetup can be cancelled.");
  }

  const nextTimestamp = nowIso();
  listing.status = "active";
  listing.escrow = {
    status: "draft",
    buyer: null,
    buyerContact: undefined,
    buyerWalletAddress: undefined,
    releaseCode: undefined,
    transactionRef: undefined,
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
