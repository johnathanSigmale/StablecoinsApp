"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";

import { appConfig } from "@/lib/config";
import { formatTon, labelEscrowStatus, toNanoString } from "@/lib/utils";

// Must match ESCROW_GAS_BUFFER_TON in escrow-service.ts
const ESCROW_GAS_BUFFER_TON = 0.05;

type PurchasePanelProps = {
  listingId: string;
  priceTon: number;
  status: string;
  escrowStatus: string;
  escrowWalletAddress?: string | null;
  buyer?: string | null;
  buyerContact?: string;
  buyerWalletAddress?: string;
  sellerWalletAddress?: string;
  cancellationReason?: string;
  transactionRef?: string;
};

type MutationResponse = {
  error?: string;
  escrowTransfer?: { ok: boolean; transactionRef?: string; error?: string };
  escrowRefund?: { ok: boolean; transactionRef?: string; error?: string };
  sellerNotification?: { ok: boolean; error?: string };
};

export function PurchasePanel({
  listingId,
  priceTon,
  status,
  escrowStatus,
  escrowWalletAddress,
  buyer,
  buyerContact,
  buyerWalletAddress,
  sellerWalletAddress,
  cancellationReason,
  transactionRef,
}: PurchasePanelProps) {
  const router = useRouter();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [buyerContactInput, setBuyerContactInput] = useState("");
  const [cancelReason, setCancelReason] = useState("Item not as described or seller did not show up.");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedEscrowState = escrowStatus === "funds_locked" ? "reserved_pending_seller" : escrowStatus;
  const escrowStatusLabel = labelEscrowStatus(escrowStatus);
  const hasEscrow = Boolean(escrowWalletAddress);
  const totalToSend = priceTon + ESCROW_GAS_BUFFER_TON;
  const attachedBuyerWallet = buyerWalletAddress || walletAddress || "";

  async function reserveListing() {
    setMessage("");

    if (hasEscrow && !walletAddress) {
      setMessage("Connect your wallet to send payment to escrow.");
      return;
    }

    try {
      let txRef: string | undefined;

      if (hasEscrow && escrowWalletAddress) {
        const txResult = (await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          network: appConfig.tonNetwork === "testnet" ? "-3" : undefined,
          messages: [{ address: escrowWalletAddress, amount: toNanoString(totalToSend) }],
        })) as { boc?: string };

        txRef = txResult?.boc
          ? `tonconnect:${txResult.boc.slice(0, 32)}`
          : `tonconnect:${Date.now()}`;
      }

      const response = await fetch(`/api/listings/${listingId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerContact: buyerContactInput || walletAddress || "unknown",
          walletAddress: walletAddress || undefined,
          transactionRef: txRef,
        }),
      });

      const body = (await response.json()) as MutationResponse;
      if (!response.ok) throw new Error(body.error || "Reservation failed.");

      const notif = body.sellerNotification?.ok ? "Seller notified." : "";
      startTransition(() => {
        setMessage(
          hasEscrow
            ? `${formatTon(totalToSend)} sent to escrow. Awaiting seller confirmation. ${notif}`.trim()
            : `Demo reservation created. ${notif}`.trim(),
        );
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reservation failed.");
    }
  }

  async function confirmTransaction() {
    setMessage("");

    try {
      const response = await fetch(`/api/listings/${listingId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body = (await response.json()) as MutationResponse;
      if (!response.ok) throw new Error(body.error || "Confirmation failed.");

      const transferMsg = body.escrowTransfer?.ok
        ? `${formatTon(priceTon)} released to seller.`
        : body.escrowTransfer?.error
          ? `Escrow transfer failed: ${body.escrowTransfer.error}`
          : "";

      startTransition(() => {
        setMessage(`Transaction confirmed. ${transferMsg}`.trim());
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Confirmation failed.");
    }
  }

  async function cancelEscrow() {
    setMessage("");

    try {
      const response = await fetch(`/api/listings/${listingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });

      const body = (await response.json()) as MutationResponse;
      if (!response.ok) throw new Error(body.error || "Cancellation failed.");

      const refundMsg = body.escrowRefund?.ok
        ? `${formatTon(priceTon)} refunded to your wallet.`
        : body.escrowRefund?.error
          ? `Refund failed: ${body.escrowRefund.error}`
          : "";

      startTransition(() => {
        setMessage(`Reservation cancelled. ${refundMsg}`.trim());
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
          <span className="eyebrow">Escrow Flow</span>
          <h2>{formatTon(priceTon)}</h2>
        </div>
        <TonConnectButton />
      </div>

      <div className="codePanel">
        <span>Current escrow step</span>
        <strong>{escrowStatusLabel}</strong>
      </div>

      <p className="mutedText">
        Escrow wallet: <strong>{escrowWalletAddress || "not configured — demo mode"}</strong>
      </p>

      <p className="mutedText">
        Seller wallet: <strong>{sellerWalletAddress || "not configured"}</strong>
      </p>

      {buyer ? (
        <p className="mutedText">
          Reserved by <strong>{buyer}</strong>
          {buyerContact ? ` (${buyerContact})` : ""}
          {attachedBuyerWallet ? ` — wallet ${attachedBuyerWallet}` : ""}
          {transactionRef ? ` — tx ${transactionRef}` : ""}
        </p>
      ) : null}

      {status === "active" ? (
        <>
          <label>
            Your Telegram username or phone
            <input
              value={buyerContactInput}
              onChange={(e) => setBuyerContactInput(e.target.value)}
              placeholder="@username or +212..."
            />
          </label>
          {hasEscrow ? (
            <p className="mutedText">
              Clicking reserve will send <strong>{formatTon(totalToSend)}</strong> ({formatTon(priceTon)} + {formatTon(ESCROW_GAS_BUFFER_TON)} gas) to the escrow wallet.
              The funds are held there until you confirm the transaction after the meetup, or refunded if you cancel.
            </p>
          ) : (
            <p className="mutedText">
              No escrow wallet configured — reservation is in demo mode. No TON will be transferred.
            </p>
          )}
          <button className="primaryButton" disabled={isPending} onClick={() => void reserveListing()}>
            {hasEscrow ? `Reserve & lock ${formatTon(totalToSend)} in escrow` : "Reserve (demo mode)"}
          </button>
        </>
      ) : null}

      {normalizedEscrowState === "reserved_pending_seller" ? (
        <>
          <p className="mutedText">
            {hasEscrow
              ? `${formatTon(totalToSend)} is locked in escrow. Waiting for the seller to accept in Telegram. You can cancel for a full refund of ${formatTon(priceTon)} at any time.`
              : "Demo reservation pending seller acceptance."}
          </p>
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void cancelEscrow()}>
            {hasEscrow ? `Cancel & get refund of ${formatTon(priceTon)}` : "Cancel reservation"}
          </button>
        </>
      ) : null}

      {normalizedEscrowState === "seller_accepted" ? (
        <>
          <p className="mutedText">
            Seller accepted the meetup. After inspecting the item in person, confirm below to release{" "}
            <strong>{formatTon(priceTon)}</strong> from escrow to the seller.
          </p>
          <button className="primaryButton" disabled={isPending} onClick={() => void confirmTransaction()}>
            I received the item — release payment to seller
          </button>
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void cancelEscrow()}>
            Item not as described — cancel & get refund
          </button>
        </>
      ) : null}

      {status === "sold" ? (
        <p className="successText">
          Transaction complete. {formatTon(priceTon)} released to the seller.
        </p>
      ) : null}
      {status === "cancelled" ? (
        <p className="errorText">
          Reservation cancelled. Reason: {cancellationReason || "Not provided."}
        </p>
      ) : null}
      {message ? <p className="mutedText">{message}</p> : null}
    </section>
  );
}
