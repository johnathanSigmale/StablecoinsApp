export type ListingStatus = "active" | "reserved" | "meetup" | "sold" | "cancelled";
export type EscrowStatus =
  | "draft"
  | "reserved_pending_seller"
  | "seller_accepted"
  | "released"
  | "cancelled"
  | "funds_locked";
export type ReservationMode = "demo" | "balance_check";

export type ListingAiInsights = {
  suggestedTitle: string;
  pricingRationale: string;
  tags: string[];
};

export type ListingGeneration = {
  textSource: "gemini" | "fallback";
  imageSource: "gemini-image" | "seller-photo" | "fallback";
  textStatusMessage?: string;
  imageStatusMessage?: string;
};

export type ListingEscrow = {
  status: EscrowStatus;
  buyer: string | null;
  buyerContact?: string;
  buyerWalletAddress?: string;
  reservationMode?: ReservationMode;
  releaseCode?: string;
  transactionRef?: string;
  balanceVerifiedAt?: string;
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
  sellerTelegramChatId?: number;
  sellerWalletAddress?: string;
  city: string;
  imageUrl: string;
  createdAt: string;
  status: ListingStatus;
  aiInsights: ListingAiInsights;
  generation?: ListingGeneration;
  escrow: ListingEscrow;
};

export type ListingDraftInput = {
  sellerPrompt: string;
  imageUrl?: string;
  sellerHandle: string;
  sellerChatId?: number;
  sellerWalletAddress?: string;
  city: string;
  desiredPriceTon?: number;
};

export type PurchaseIntent = {
  buyerName?: string;
  buyerContact: string;
  walletAddress?: string;
  reservationMode: ReservationMode;
};

export type ListingDraft = {
  title: string;
  summary: string;
  category: string;
  condition: string;
  city: string;
  priceTon: number;
  aiInsights: ListingAiInsights;
};
