import { promises as fs } from "fs";
import path from "path";

import { hasRedisStore, readRedisJson, writeRedisJson } from "@/lib/server/redis-store";

export type SellerProfile = {
  chatId: number;
  sellerHandle?: string;
  walletAddress: string;
  updatedAt: string;
  pendingContext?: {
    prompt: string;
    imageDataUrl?: string;
    askedAt: string;
  };
};

type SellerProfilesStore = Record<string, SellerProfile>;

const runtimeDirectory = process.env.TMPDIR || process.env.TEMP || "/tmp";
const localStoragePath =
  process.env.NODE_ENV === "production"
    ? path.join(runtimeDirectory, "johnton-seller-profiles.json")
    : path.join(process.cwd(), "data", "seller-profiles.json");

async function ensureLocalStore() {
  try {
    await fs.access(localStoragePath);
  } catch {
    await fs.mkdir(path.dirname(localStoragePath), { recursive: true });
    await fs.writeFile(localStoragePath, "{}", "utf8");
  }
}

async function readLocalProfiles() {
  await ensureLocalStore();

  try {
    const raw = await fs.readFile(localStoragePath, "utf8");
    return JSON.parse(raw) as SellerProfilesStore;
  } catch (error) {
    console.error("Local seller profile read failed:", error);
    return {};
  }
}

async function writeLocalProfiles(profiles: SellerProfilesStore) {
  await ensureLocalStore();
  await fs.writeFile(localStoragePath, JSON.stringify(profiles, null, 2), "utf8");
}

export async function readSellerProfiles() {
  if (hasRedisStore()) {
    const profiles = await readRedisJson<SellerProfilesStore>("seller_profiles");
    if (profiles && typeof profiles === "object") {
      return profiles;
    }
  }

  return readLocalProfiles();
}

export async function writeSellerProfiles(profiles: SellerProfilesStore) {
  if (hasRedisStore()) {
    const stored = await writeRedisJson("seller_profiles", profiles);
    if (stored) {
      return;
    }
  }

  await writeLocalProfiles(profiles);
}

export async function getSellerProfile(chatId: number) {
  const profiles = await readSellerProfiles();
  return profiles[String(chatId)] ?? null;
}

export async function upsertSellerProfile(profile: SellerProfile) {
  const profiles = await readSellerProfiles();
  profiles[String(profile.chatId)] = profile;
  await writeSellerProfiles(profiles);
  return profile;
}
