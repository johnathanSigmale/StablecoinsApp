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
