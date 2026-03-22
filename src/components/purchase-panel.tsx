"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";

import { appConfig } from "@/lib/config";
import type { ReservationMode } from "@/lib/types";
import { formatTon, labelEscrowStatus, toNanoString } from "@/lib/utils";

const PLATFORM_FEE_PERCENT = 2;

type PurchasePanelProps = {
  listingId: string;
  priceTon: number;
  status: string;
  escrowStatus: string;
  reservationMode?: ReservationMode;
  buyer?: string | null;
  buyerContact?: string;
  buyerWalletAddress?: string;
  sellerWalletAddress?: string;
  cancellationReason?: string;
};

type ReservationResponse = {
  error?: string;
  sellerNotification?: {
    ok: boolean;
    error?: string;
  };
  balanceCheck?: {
    ok: boolean;
    statusMessage: string;
    balanceTon: number;
  };
};

type MutationResponse = {
  error?: string;
  sellerNotification?: {
    ok: boolean;
    error?: string;
  };
};

export function PurchasePanel({
  listingId,
  priceTon,
  status,
  escrowStatus,
  reservationMode,
  buyer,
  buyerContact,
  buyerWalletAddress,
  sellerWalletAddress,
  cancellationReason,
}: PurchasePanelProps) {
  const router = useRouter();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [buyerName, setBuyerName] = useState("");
  const [buyerContactInput, setBuyerContactInput] = useState("@buyer");
  const [cancelReason, setCancelReason] = useState("Item not as described or seller did not show up.");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedEscrowState = escrowStatus === "funds_locked" ? "reserved_pending_seller" : escrowStatus;
  const escrowStatusLabel = labelEscrowStatus(escrowStatus);
  const effectiveReservationMode = reservationMode ?? (sellerWalletAddress ? "balance_check" : "demo");
  const attachedBuyerWallet = buyerWalletAddress || walletAddress || "";
  const feeTon = Math.round(priceTon * PLATFORM_FEE_PERCENT) / 100;

  async function purchaseListing() {
    setMessage("");

    if (!walletAddress) {
      setMessage("Connect your TON wallet to reserve this item.");
      return;
    }

    if (!sellerWalletAddress) {
      setMessage("The seller hasn't connected a wallet yet. Reservation is unavailable.");
      return;
    }

    try {
      const response = await fetch(`/api/listings/${listingId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName: buyerName || undefined,
          buyerContact: buyerContactInput,
          walletAddress,
          reservationMode: "balance_check",
        }),
      });

      const body = (await response.json()) as ReservationResponse;
      if (!response.ok) {
        throw new Error(body.error || "Purchase failed.");
      }

      const notificationMessage = body.sellerNotification?.ok
        ? "The seller was notified on Telegram."
        : `Seller notification failed: ${body.sellerNotification?.error || "Unknown error."}`;
      const balanceMessage = body.balanceCheck?.ok
        ? `Balance verified: ${body.balanceCheck.balanceTon.toFixed(3)} TON available.`
        : "";

      startTransition(() => {
        setMessage(`Reservation confirmed. ${balanceMessage} ${notificationMessage}`.trim());
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase failed.");
    }
  }

  async function releaseEscrow() {
    setMessage("");

    try {
      let transactionRef: string | undefined;

      if (effectiveReservationMode === "balance_check") {
        if (!walletAddress) {
          throw new Error("Connect the buyer wallet before sending the TON transfer.");
        }

        if (!sellerWalletAddress) {
          throw new Error("No seller wallet is configured for this listing.");
        }

        const transactionResult = (await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: appConfig.tonNetwork === "testnet" ? "-3" : undefined,
          messages: [
            {
              address: sellerWalletAddress,
              amount: toNanoString(priceTon),
            },
          ],
        })) as { boc?: string };

        transactionRef = transactionResult?.boc
          ? `tonconnect:${transactionResult.boc.slice(0, 32)}`
          : `tonconnect:${Date.now()}`;
      }

      const response = await fetch(`/api/listings/${listingId}/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactionRef }),
      });

      const body = (await response.json()) as MutationResponse;
      if (!response.ok) {
        throw new Error(body.error || "Release failed.");
      }

      const sellerMessage = body.sellerNotification?.ok
        ? "The seller was notified on Telegram."
        : body.sellerNotification?.error
          ? `Seller Telegram notification failed: ${body.sellerNotification.error}`
          : "";

      startTransition(() => {
        setMessage(`Transaction confirmed. TON sent to the seller. ${sellerMessage}`.trim());
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Release failed.");
    }
  }

  async function cancelEscrow() {
    setMessage("");

    try {
      const response = await fetch(`/api/listings/${listingId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: cancelReason || undefined,
        }),
      });

      const body = (await response.json()) as MutationResponse;
      if (!response.ok) {
        throw new Error(body.error || "Cancellation failed.");
      }

      const notificationMessage = body.sellerNotification?.ok
        ? "The seller was notified on Telegram."
        : `Seller Telegram notification failed: ${body.sellerNotification?.error || "Unknown error."}`;

      startTransition(() => {
        setMessage(`Reservation cancelled. ${notificationMessage}`);
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cancellation failed.");
    }
  }

  return (
    <section className="glassPanel purchasePanel">
      <div className="purchaseHeader">
        <div>
          <span className="eyebrow">Secure Escrow</span>
          <h2>{formatTon(priceTon)}</h2>
        </div>
        <TonConnectButton />
      </div>

      <div className="codePanel">
        <span>Escrow status</span>
        <strong>{escrowStatusLabel}</strong>
      </div>

      <div className="codePanel">
        <span>{PLATFORM_FEE_PERCENT}% JohnTon fee</span>
        <strong>{feeTon.toFixed(3)} TON · paid by seller at release</strong>
      </div>

      {buyer ? (
        <p className="mutedText">
          Reserved by <strong>{buyer}</strong>
          {buyerContact ? ` · ${buyerContact}` : ""}
          {attachedBuyerWallet ? ` · ${attachedBuyerWallet.slice(0, 8)}…` : ""}
        </p>
      ) : null}

      {status === "active" ? (
        <>
          <label>
            Your name
            <input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Optional" />
          </label>
          <label>
            Your Telegram username or phone
            <input
              value={buyerContactInput}
              onChange={(event) => setBuyerContactInput(event.target.value)}
              placeholder="@username or +212..."
            />
          </label>
          <p className="mutedText">
            Connect your TON wallet and reserve. No payment moves until you confirm the transaction after the in-person meetup.
          </p>
          <button className="primaryButton" disabled={isPending} onClick={() => void purchaseListing()}>
            Reserve and verify balance
          </button>
        </>
      ) : null}

      {normalizedEscrowState === "reserved_pending_seller" ? (
        <>
          <p className="mutedText">
            Your reservation is confirmed. The seller will accept or cancel via Telegram.
          </p>
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void cancelEscrow()}>
            Cancel reservation
          </button>
        </>
      ) : null}

      {normalizedEscrowState === "seller_accepted" ? (
        <>
          <p className="mutedText">
            The seller accepted. Inspect the item in person, then confirm to send payment.
          </p>
          <button className="primaryButton" disabled={isPending} onClick={() => void releaseEscrow()}>
            Confirm transaction and pay seller
          </button>
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void cancelEscrow()}>
            Reject item or cancel meetup
          </button>
        </>
      ) : null}

      {status === "sold" ? (
        <p className="successText">
          Transaction confirmed. TON sent to the seller.
        </p>
      ) : null}
      {status === "cancelled" ? (
        <p className="errorText">Meetup cancelled. Reason: {cancellationReason || "Not provided."}</p>
      ) : null}
      {message ? <p className="mutedText">{message}</p> : null}
    </section>
  );
}

