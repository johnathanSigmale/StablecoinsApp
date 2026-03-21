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
  releaseCode?: string;
  escrowStatus: string;
};

export function PurchasePanel({ listingId, priceTon, status, releaseCode, escrowStatus }: PurchasePanelProps) {
  const router = useRouter();
  const walletAddress = useTonAddress();
  const [buyerHandle, setBuyerHandle] = useState("@buyer");
  const [manualCode, setManualCode] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [tonConnectUI] = useTonConnectUI();

  const canSendTon = Boolean(appConfig.demoTonAddress);

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

      const response = await fetch(`/api/listings/${listingId}/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyerHandle,
          walletAddress: walletAddress || undefined,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Purchase failed.");
      }

      startTransition(() => {
        setMessage(canSendTon ? "Funds locked. Waiting for seller release." : "Escrow simulated for demo flow.");
        router.refresh();
      });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Purchase failed.";
      setMessage(nextMessage);
    }
  }

  async function releaseEscrow() {
    setMessage("");

    const response = await fetch(`/api/listings/${listingId}/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        releaseCode: manualCode || undefined,
      }),
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(body.error || "Release failed.");
      return;
    }

    startTransition(() => {
      setMessage("Escrow released. Listing closed as sold.");
      router.refresh();
    });
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
          ? "Wallet-connected purchase sends TON to the demo escrow address, then the seller releases after meetup verification."
          : "Set NEXT_PUBLIC_DEMO_TON_ADDRESS to enable a real TON Connect testnet transfer. Until then, the escrow flow stays fully simulated."}
      </p>

      {status === "active" ? (
        <>
          <label>
            Buyer handle
            <input value={buyerHandle} onChange={(event) => setBuyerHandle(event.target.value)} />
          </label>
          <button className="primaryButton" disabled={isPending} onClick={() => void purchaseListing()}>
            {canSendTon ? "Lock funds with TON" : "Simulate escrow purchase"}
          </button>
        </>
      ) : null}

      {escrowStatus === "awaiting_release" ? (
        <>
          <div className="codePanel">
            <span>Release code</span>
            <strong>{releaseCode || "Pending"}</strong>
          </div>
          <label>
            Confirm release code
            <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Optional in demo mode" />
          </label>
          <button className="secondaryButton" disabled={isPending} onClick={() => void releaseEscrow()}>
            Release funds after meetup
          </button>
        </>
      ) : null}

      {status === "sold" ? <p className="successText">This listing has been sold and the escrow was released.</p> : null}
      {message ? <p className="mutedText">{message}</p> : null}
    </section>
  );
}
