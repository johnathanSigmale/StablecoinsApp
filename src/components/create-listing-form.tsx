"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CreateResponse = {
  id: string;
};

const initialState = {
  sellerPrompt: "",
  imageUrl: "",
  sellerHandle: "@you",
  city: "Casablanca",
  desiredPriceTon: "",
};

export function CreateListingForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateField(name: string, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function onSubmit(formData: FormData) {
    setError("");

    const payload = {
      sellerPrompt: String(formData.get("sellerPrompt") || ""),
      imageUrl: String(formData.get("imageUrl") || ""),
      sellerHandle: String(formData.get("sellerHandle") || ""),
      city: String(formData.get("city") || ""),
      desiredPriceTon: Number(formData.get("desiredPriceTon") || 0) || undefined,
    };

    const response = await fetch("/api/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Unable to create listing.");
      return;
    }

    const listing = (await response.json()) as CreateResponse;
    startTransition(() => {
      router.push(`/listings/${listing.id}`);
      router.refresh();
    });
  }

  return (
    <form
      className="glassPanel formPanel"
      action={(formData) => {
        void onSubmit(formData);
      }}
    >
      <div className="formIntro">
        <span className="eyebrow">Seller Flow</span>
        <h2>Create a listing from one message</h2>
        <p>
          This mirrors the Telegram bot flow: the seller sends a natural-language message and optionally an image URL,
          then the AI drafts a clean listing and suggested price.
        </p>
      </div>

      <label>
        Seller prompt
        <textarea
          name="sellerPrompt"
          placeholder="Example: Selling my Meta Quest 2, clean lenses, includes charger and case, barely used."
          value={form.sellerPrompt}
          onChange={(event) => updateField("sellerPrompt", event.target.value)}
          required
          rows={5}
        />
      </label>

      <div className="formGrid">
        <label>
          Image URL
          <input
            name="imageUrl"
            type="url"
            value={form.imageUrl}
            onChange={(event) => updateField("imageUrl", event.target.value)}
            placeholder="https://..."
          />
        </label>

        <label>
          Seller handle
          <input
            name="sellerHandle"
            value={form.sellerHandle}
            onChange={(event) => updateField("sellerHandle", event.target.value)}
            required
          />
        </label>
      </div>

      <div className="formGrid">
        <label>
          City
          <input name="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} required />
        </label>

        <label>
          Preferred TON price
          <input
            name="desiredPriceTon"
            type="number"
            min="1"
            step="1"
            value={form.desiredPriceTon}
            onChange={(event) => updateField("desiredPriceTon", event.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>

      {error ? <p className="errorText">{error}</p> : null}

      <button className="primaryButton" type="submit" disabled={isPending}>
        {isPending ? "Creating listing..." : "Generate listing draft"}
      </button>
    </form>
  );
}
