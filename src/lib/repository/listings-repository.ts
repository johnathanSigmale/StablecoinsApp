import { kv } from "@vercel/kv";
import { promises as fs } from "fs";
import path from "path";

import type { Listing } from "@/lib/types";

const LOCAL_STORAGE_PATH = path.join(process.cwd(), "data", "listings.json");

async function getLocalListings() {
  try {
    const raw = await fs.readFile(LOCAL_STORAGE_PATH, "utf8");
    return JSON.parse(raw) as Listing[];
  } catch {
    return [];
  }
}

export async function readListings() {
  if (process.env.NODE_ENV === "production" || process.env.KV_URL) {
    try {
      const listings = await kv.get<Listing[]>("listings");
      return listings || [];
    } catch (error) {
      console.error("KV Read Error:", error);
      return [];
    }
  }
  return getLocalListings();
}

export async function writeListings(listings: Listing[]) {
  if (process.env.NODE_ENV === "production" || process.env.KV_URL) {
    await kv.set("listings", listings);
  } else {
    await fs.mkdir(path.dirname(LOCAL_STORAGE_PATH), { recursive: true });
    await fs.writeFile(LOCAL_STORAGE_PATH, JSON.stringify(listings, null, 2), "utf8");
  }
}

export async function getListingById(id: string) {
  const listings = await readListings();
  return listings.find((listing) => listing.id === id) ?? null;
}
