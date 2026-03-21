export type ListingStatus = "active" | "reserved" | "sold";
export type EscrowStatus = "draft" | "awaiting_release" | "released" | "cancelled";

export type ListingAiInsights = {
  suggestedTitle: string;
  pricingRationale: string;
  tags: string[];
};

export type ListingEscrow = {
  status: EscrowStatus;
  buyer: string | null;
  releaseCode?: string;
  transactionRef?: string;
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
