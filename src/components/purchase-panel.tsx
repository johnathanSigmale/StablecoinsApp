"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";

import { appConfig } from "@/lib/config";
import { formatTon } from "@/lib/utils";

type PurchasePanelProps = {
  listingId: string;
  priceTon: number;
  status: string;
  escrowStatus: string;
  releaseCode?: string;
  buyer?: string | null;
  cancellationReason?: string;
};

export function PurchasePanel({
  listingId,
  priceTon,
  status,
  escrowStatus,
  releaseCode,
  buyer,
  cancellationReason,
}: PurchasePanelProps) {
  const router = useRouter();
  const walletAddress = useTonAddress();
  const [buyerHandle, setBuyerHandle] = useState("@buyer");
  const [manualCode, setManualCode] = useState("");
  const [cancelReason, setCancelReason] = useState("Item not as described or seller did not show up.");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [tonConnectUI] = useTonConnectUI();

  const canSendTon = Boolean(appConfig.demoTonAddress);

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
      if (canSendTon) {
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: [
            {
              address: appConfig.demoTonAddress,
              amount: String(Math.round(priceTon * 1_000_000_000)),
            },
          ],
        });
      }

      await postAction(
        `/api/listings/${listingId}/purchase`,
        {
          buyerHandle,
          walletAddress: walletAddress || undefined,
        },
        canSendTon
          ? "Funds are locked. The seller can now verify the payment and accept the meetup."
          : "Escrow was simulated. The seller can now accept the meetup in the demo flow.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase failed.");
    }
  }

  async function acceptMeetup() {
    setMessage("");

    try {
      await postAction(
        `/api/listings/${listingId}/seller-accept`,
        {},
        "Seller accepted the meetup. The buyer can inspect the item in person and then release or cancel.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seller acceptance failed.");
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
          <span className="eyebrow">Secure Checkout</span>
          <h2>{formatTon(priceTon)}</h2>
        </div>
        <TonConnectButton />
      </div>

      <p className="mutedText">
        {canSendTon
          ? "Buyer locks TON first. Seller accepts the meetup only after seeing funds are locked."
          : "No demo TON address is configured, so the app simulates the same escrow flow without a live transfer."}
      </p>

      <div className="codePanel">
        <span>Current escrow step</span>
        <strong>{escrowStatus}</strong>
      </div>

      {buyer ? (
        <p className="mutedText">
          Buyer attached to this escrow: <strong>{buyer}</strong>
        </p>
      ) : null}

      {status === "active" ? (
        <>
          <label>
            Buyer handle
            <input value={buyerHandle} onChange={(event) => setBuyerHandle(event.target.value)} />
          </label>
          <button className="primaryButton" disabled={isPending} onClick={() => void purchaseListing()}>
            {canSendTon ? "Lock funds with TON" : "Simulate buyer reservation"}
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
            The buyer has locked funds. The seller should verify the payment and then accept the meetup.
          </p>
          <button className="primaryButton" disabled={isPending} onClick={() => void acceptMeetup()}>
            Seller accepts meetup
          </button>
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void cancelEscrow()}>
            Cancel if seller is unavailable
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
            The seller accepted the meetup. The buyer now inspects the item in real life and decides whether to release
            or cancel.
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
