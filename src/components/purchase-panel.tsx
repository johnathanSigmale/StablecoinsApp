"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";

import { appConfig } from "@/lib/config";
import type { ReservationMode } from "@/lib/types";
import { formatTon, labelEscrowStatus, toNanoString } from "@/lib/utils";

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

function describeReservationMode(mode?: ReservationMode) {
  if (mode === "balance_check") {
    return "real balance-check mode";
  }

  return "demo mode";
}

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
  const [reservationModeInput, setReservationModeInput] = useState<ReservationMode>(
    sellerWalletAddress ? "balance_check" : "demo",
  );
  const [cancelReason, setCancelReason] = useState("Item not as described or seller did not show up.");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedEscrowState = escrowStatus === "funds_locked" ? "reserved_pending_seller" : escrowStatus;
  const escrowStatusLabel = labelEscrowStatus(escrowStatus);
  const effectiveReservationMode = reservationMode || reservationModeInput;
  const attachedBuyerWallet = buyerWalletAddress || walletAddress || "";
  async function purchaseListing() {
    setMessage("");

    if (reservationModeInput === "balance_check" && !walletAddress) {
      setMessage("Connect the buyer wallet before using real balance-check mode.");
      return;
    }

    if (reservationModeInput === "balance_check" && !sellerWalletAddress) {
      setMessage("This listing has no seller wallet configured, so only demo mode is available.");
      return;
    }

    try {
      const response = await fetch(`/api/listings/${listingId}/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyerName: buyerName || undefined,
          buyerContact: buyerContactInput,
          walletAddress: walletAddress || undefined,
          reservationMode: reservationModeInput,
        }),
      });

      const body = (await response.json()) as ReservationResponse;
      if (!response.ok) {
        throw new Error(body.error || "Purchase failed.");
      }

      const notificationMessage = body.sellerNotification?.ok
        ? "The seller was notified on Telegram."
        : `Seller Telegram notification failed: ${body.sellerNotification?.error || "Unknown error."}`;
      const balanceMessage =
        reservationModeInput === "balance_check" && body.balanceCheck?.ok
          ? `Buyer balance verified: ${body.balanceCheck.balanceTon.toFixed(3)} TON available.`
          : "No TON was transferred at reservation time.";

      startTransition(() => {
        setMessage(`Reservation created in ${describeReservationMode(reservationModeInput)}. ${balanceMessage} ${notificationMessage}`);
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
        setMessage(
          effectiveReservationMode === "balance_check"
            ? `Transaction confirmed. TON sent to the seller. ${sellerMessage}`.trim()
            : `Transaction confirmed in demo mode. ${sellerMessage}`.trim(),
        );
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
          <span className="eyebrow">Reservation Flow</span>
          <h2>{formatTon(priceTon)}</h2>
        </div>
        <TonConnectButton />
      </div>

      <p className="mutedText">
        Real mode verifies the buyer has enough TON at reservation time. Payment is only sent to the seller when the buyer confirms the transaction after the meetup.
      </p>

      <div className="codePanel">
        <span>Current escrow step</span>
        <strong>{escrowStatusLabel}</strong>
      </div>

      <p className="mutedText">
        Seller wallet: <strong>{sellerWalletAddress || "not configured"}</strong>
      </p>

      {buyer ? (
        <p className="mutedText">
          Buyer attached to this reservation: <strong>{buyer}</strong>
          {buyerContact ? ` (${buyerContact})` : ""}
          {attachedBuyerWallet ? ` - wallet ${attachedBuyerWallet}` : ""}
        </p>
      ) : null}

      {status === "active" ? (
        <>
          <label>
            Buyer name
            <input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Optional" />
          </label>
          <label>
            Telegram username or phone
            <input
              value={buyerContactInput}
              onChange={(event) => setBuyerContactInput(event.target.value)}
              placeholder="@username or +212..."
            />
          </label>
          <label>
            Reservation mode
            <select
              value={reservationModeInput}
              onChange={(event) => setReservationModeInput(event.target.value as ReservationMode)}
            >
              <option value="demo">Demo reservation only</option>
              <option value="balance_check" disabled={!sellerWalletAddress}>
                Real release flow: verify buyer balance now, pay seller at meetup release
              </option>
            </select>
          </label>
          {reservationModeInput === "balance_check" ? (
            <p className="mutedText">
              Connected buyer wallet required now. TON will not move until the buyer enters the seller code at meetup time.
            </p>
          ) : null}
          <button className="primaryButton" disabled={isPending} onClick={() => void purchaseListing()}>
            {reservationModeInput === "balance_check" ? "Reserve meetup and verify buyer balance" : "Reserve meetup in demo mode"}
          </button>
        </>
      ) : null}

      {normalizedEscrowState === "reserved_pending_seller" ? (
        <>
          <p className="mutedText">
            The meetup is reserved in <strong>{describeReservationMode(effectiveReservationMode)}</strong>. The seller now decides in
            Telegram whether to accept or cancel. The private release code remains seller-side only.
          </p>
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void cancelEscrow()}>
            Buyer cancels reservation
          </button>
        </>
      ) : null}

      {normalizedEscrowState === "seller_accepted" ? (
        <>
          <p className="mutedText">
            The seller accepted the meetup. After inspecting the item in person, confirm the transaction to send payment to the seller.
          </p>
          <button className="primaryButton" disabled={isPending} onClick={() => void releaseEscrow()}>
            {effectiveReservationMode === "balance_check"
              ? "Confirm transaction and pay seller"
              : "Confirm transaction (demo)"}
          </button>
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void cancelEscrow()}>
            Buyer rejects item or cancels meetup
          </button>
        </>
      ) : null}

      {status === "sold" ? (
        <p className="successText">
          The buyer confirmed the transaction
          {effectiveReservationMode === "balance_check" ? " and TON was sent to the seller." : " in demo mode."}
        </p>
      ) : null}
      {status === "cancelled" ? (
        <p className="errorText">The meetup did not complete. Reason: {cancellationReason || "Not provided."}</p>
      ) : null}
      {message ? <p className="mutedText">{message}</p> : null}
    </section>
  );
}

