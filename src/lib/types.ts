export type ListingStatus = "active" | "reserved" | "meetup" | "sold" | "cancelled";
export type EscrowStatus = "draft" | "funds_locked" | "seller_accepted" | "released" | "cancelled";

export type ListingAiInsights = {
  suggestedTitle: string;
  pricingRationale: string;
  tags: string[];
};

export type ListingEscrow = {
  status: EscrowStatus;
  buyer: string | null;
  buyerWalletAddress?: string;
  releaseCode?: string;
  transactionRef?: string;
  fundsLockedAt?: string;
  sellerAcceptedAt?: string;
  releasedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  lastUpdatedAt: string;
};

export type Listing = {
  id: string;
  title: string;
  summary: string;
  category: string;
  condition: string;
  priceTon: number;
  sellerHandle: string;
  city: string;
  imageUrl: string;
  createdAt: string;
  status: ListingStatus;
  aiInsights: ListingAiInsights;
  escrow: ListingEscrow;
};

export type ListingDraftInput = {
  sellerPrompt: string;
  imageUrl?: string;
  sellerHandle: string;
  city: string;
  desiredPriceTon?: number;
};

export type PurchaseIntent = {
  buyerHandle: string;
  walletAddress?: string;
};

export type ListingDraft = {
  title: string;
  summary: string;
  category: string;
  condition: string;
  priceTon: number;
  aiInsights: ListingAiInsights;
};
