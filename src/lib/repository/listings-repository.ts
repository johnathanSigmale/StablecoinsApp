import { promises as fs } from "fs";
import path from "path";

import type { Listing } from "@/lib/types";

const dataPath = path.join(process.cwd(), "data", "listings.json");

async function ensureStore() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, "[]", "utf8");
  }
}

export async function readListings() {
  await ensureStore();
  const raw = await fs.readFile(dataPath, "utf8");
  return JSON.parse(raw) as Listing[];
}

export async function writeListings(listings: Listing[]) {
  await ensureStore();
  await fs.writeFile(dataPath, JSON.stringify(listings, null, 2), "utf8");
}

export async function getListingById(id: string) {
  const listings = await readListings();
  return listings.find((listing) => listing.id === id) ?? null;
}
