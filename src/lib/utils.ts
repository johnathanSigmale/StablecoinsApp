export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function formatTon(amount: number) {
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} TON`;
}

export function toneFromCondition(condition: string) {
  const normalized = condition.toLowerCase();

  if (normalized.includes("excellent")) {
    return "Looks premium and resale-ready.";
  }

  if (normalized.includes("very good")) {
    return "Strong value with only minor wear.";
  }

  if (normalized.includes("good")) {
    return "Practical pricing with honest wear expectations.";
  }

  return "Priced to move quickly in local groups.";
}

export function toNanoString(amountTon: number) {
  const normalized = amountTon.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 9,
  });
  const [wholePart, fractionPart = ""] = normalized.split(".");
  const whole = BigInt(wholePart || "0");
  const fraction = BigInt((fractionPart + "000000000").slice(0, 9));

  return (whole * 1_000_000_000n + fraction).toString();
}

export function fromNanoString(amountNano: string) {
  const normalized = amountNano.trim();
  if (!normalized) {
    return 0;
  }

  const value = BigInt(normalized);
  const whole = value / 1_000_000_000n;
  const fraction = value % 1_000_000_000n;
  const fractionText = fraction.toString().padStart(9, "0").replace(/0+$/, "");

  return Number(fractionText ? `${whole}.${fractionText}` : whole.toString());
}

export function isLikelyTonAddress(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return false;
  }

  if (/^-?\d:[0-9a-fA-F]{64}$/.test(normalized)) {
    return true;
  }

  return /^[A-Za-z0-9_-]{48,64}$/.test(normalized);
}

export function labelEscrowStatus(status: string) {
  switch (status) {
    case "reserved_pending_seller":
    case "funds_locked":
      return "Reserved pending seller";
    case "seller_accepted":
      return "Seller accepted meetup";
    case "released":
      return "Released";
    case "cancelled":
      return "Cancelled";
    default:
      return "Draft";
  }
}

