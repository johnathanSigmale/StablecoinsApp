"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";

import { formatTon } from "@/lib/utils";

type PurchasePanelProps = {
  listingId: string;
  priceTon: number;
  status: string;
  escrowStatus: string;
  releaseCode?: string;
  buyer?: string | null;
  buyerContact?: string;
  cancellationReason?: string;
};

export function PurchasePanel({
  listingId,
  priceTon,
  status,
  escrowStatus,
  releaseCode,
  buyer,
  buyerContact,
  cancellationReason,
}: PurchasePanelProps) {
  const router = useRouter();
  const walletAddress = useTonAddress();
  const [buyerName, setBuyerName] = useState("");
  const [buyerContactInput, setBuyerContactInput] = useState("@buyer");
  const [manualCode, setManualCode] = useState("");
  const [cancelReason, setCancelReason] = useState("Item not as described or seller did not show up.");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function postAction(path: string, payload: Record<string, string | undefined>, successMessage: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error || "Action failed.");
    }

    startTransition(() => {
      setMessage(successMessage);
      router.refresh();
    });
  }

  async function purchaseListing() {
    setMessage("");

    try {
      await postAction(
        `/api/listings/${listingId}/purchase`,
        {
          buyerName: buyerName || undefined,
          buyerContact: buyerContactInput,
          walletAddress: walletAddress || undefined,
        },
        "Reservation created. No TON was transferred. The seller can now accept or cancel from Telegram.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase failed.");
    }
  }

  async function releaseEscrow() {
    setMessage("");

    try {
      await postAction(
        `/api/listings/${listingId}/release`,
        {
          releaseCode: manualCode || undefined,
        },
        "Buyer confirmed the item after inspection. Funds were released to the seller.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Release failed.");
    }
  }

  async function cancelEscrow() {
    setMessage("");

    try {
      await postAction(
        `/api/listings/${listingId}/cancel`,
        {
          reason: cancelReason || undefined,
        },
        "The meetup was cancelled. Funds stay unreleased in the demo flow.",
      );
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
        Reservation is currently a demo hold. No TON is transferred at reservation time. Wallet connection is only used
        to attach the buyer wallet when available.
      </p>

      <div className="codePanel">
        <span>Current escrow step</span>
        <strong>{escrowStatus}</strong>
      </div>

      {buyer ? (
        <p className="mutedText">
          Buyer attached to this escrow: <strong>{buyer}</strong>
          {buyerContact ? ` (${buyerContact})` : ""}
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
          <button className="primaryButton" disabled={isPending} onClick={() => void purchaseListing()}>
            Reserve item without TON transfer
          </button>
        </>
      ) : null}

      {escrowStatus === "funds_locked" ? (
        <>
          <div className="codePanel">
            <span>Meetup release code</span>
            <strong>{releaseCode || "Pending"}</strong>
          </div>
          <p className="mutedText">
            The item is reserved. The seller must accept or cancel directly in Telegram. The buyer can still cancel from here if
            the meetup falls through.
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

      {escrowStatus === "seller_accepted" ? (
        <>
          <div className="codePanel">
            <span>Meetup release code</span>
            <strong>{releaseCode || "Pending"}</strong>
          </div>
          <p className="mutedText">
            The seller accepted the meetup in Telegram. The buyer now inspects the item in real life and decides whether to
            release or cancel.
          </p>
          <label>
            Confirm release code
            <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Optional in demo mode" />
          </label>
          <button className="primaryButton" disabled={isPending} onClick={() => void releaseEscrow()}>
            Buyer confirms item and releases funds
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

      {status === "sold" ? <p className="successText">The buyer accepted the item in person and the seller was paid.</p> : null}
      {status === "cancelled" ? (
        <p className="errorText">The meetup did not complete. Reason: {cancellationReason || "Not provided."}</p>
      ) : null}
      {message ? <p className="mutedText">{message}</p> : null}
    </section>
  );
}
