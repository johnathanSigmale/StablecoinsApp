import { createListingId, generateListingDraft } from "@/lib/services/ai-listing-service";
import { getListingById, readListings, writeListings } from "@/lib/repository/listings-repository";
import type { Listing, ListingDraftInput, PurchaseIntent } from "@/lib/types";

export async function listListings() {
  const listings = await readListings();
  return listings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findListing(id: string) {
  return getListingById(id);
}

export async function createListing(input: ListingDraftInput) {
  const draft = await generateListingDraft(input);

  const listing: Listing = {
    id: createListingId(draft.title),
    title: draft.title,
    summary: draft.summary,
    category: draft.category,
    condition: draft.condition,
    priceTon: draft.priceTon,
    sellerHandle: input.sellerHandle,
    city: input.city,
    imageUrl:
      input.imageUrl ||
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    createdAt: new Date().toISOString(),
    status: "active",
    aiInsights: draft.aiInsights,
    escrow: {
      status: "draft",
      buyer: null,
      lastUpdatedAt: new Date().toISOString(),
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

  listing.status = "reserved";
  listing.escrow = {
    status: "awaiting_release",
    buyer: purchaseIntent.buyerHandle,
    releaseCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    transactionRef: purchaseIntent.walletAddress || "demo-simulation",
    lastUpdatedAt: new Date().toISOString(),
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

  if (listing.escrow.status !== "awaiting_release") {
    throw new Error("Escrow is not waiting for release.");
  }

  if (listing.escrow.releaseCode && providedCode && listing.escrow.releaseCode !== providedCode.trim().toUpperCase()) {
    throw new Error("Release code does not match.");
  }

  listing.status = "sold";
  listing.escrow = {
    ...listing.escrow,
    status: "released",
    lastUpdatedAt: new Date().toISOString(),
  };

  await writeListings(listings);
  return listing;
}
