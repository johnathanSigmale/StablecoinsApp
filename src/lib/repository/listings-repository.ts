import { promises as fs } from "fs";
import path from "path";

import type { Listing } from "@/lib/types";
import { hasRedisStore, readRedisJson, writeRedisJson } from "@/lib/server/redis-store";

const runtimeDirectory = process.env.TMPDIR || process.env.TEMP || "/tmp";
const localStoragePath =
  process.env.NODE_ENV === "production"
    ? path.join(runtimeDirectory, "flipbot-ai-listings.json")
    : path.join(process.cwd(), "data", "listings.json");

async function ensureLocalStore() {
  try {
    await fs.access(localStoragePath);
  } catch {
    await fs.mkdir(path.dirname(localStoragePath), { recursive: true });
    await fs.writeFile(localStoragePath, "[]", "utf8");
  }
}

async function readLocalListings() {
  await ensureLocalStore();

  try {
    const raw = await fs.readFile(localStoragePath, "utf8");
    return JSON.parse(raw) as Listing[];
  } catch (error) {
    console.error("Local listing read failed:", error);
    return [];
  }
}

async function writeLocalListings(listings: Listing[]) {
  await ensureLocalStore();
  await fs.writeFile(localStoragePath, JSON.stringify(listings, null, 2), "utf8");
}

export async function readListings() {
  if (hasRedisStore()) {
    const listings = await readRedisJson<Listing[]>("listings");
    if (Array.isArray(listings)) {
      return listings;
    }
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("Persistent Redis storage is not configured. Falling back to local runtime storage.");
  }

  return readLocalListings();
}

export async function writeListings(listings: Listing[]) {
  if (hasRedisStore()) {
    const stored = await writeRedisJson("listings", listings);
    if (stored) {
      return;
    }
  }

  await writeLocalListings(listings);
}

export async function getListingById(id: string) {
  const listings = await readListings();
  return listings.find((listing) => listing.id === id) ?? null;
}
