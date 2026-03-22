import { appConfig } from "@/lib/config";
import { fromNanoString, isLikelyTonAddress, toNanoString } from "@/lib/utils";

type TonBalanceResult =
  | {
      ok: true;
      balanceNano: string;
      balanceTon: number;
      statusMessage: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function getTonAddressBalance(address: string): Promise<TonBalanceResult> {
  if (!isLikelyTonAddress(address)) {
    return {
      ok: false,
      error: "Wallet address format is invalid.",
    };
  }

  try {
    const response = await fetch(
      `${appConfig.tonApiBaseUrl}/getAddressBalance?address=${encodeURIComponent(address)}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        error: `TON balance lookup failed with HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      result?: string;
    };

    if (!payload.ok || typeof payload.result !== "string") {
      return {
        ok: false,
        error: "TON balance lookup returned no usable balance.",
      };
    }

    return {
      ok: true,
      balanceNano: payload.result,
      balanceTon: fromNanoString(payload.result),
      statusMessage: `Wallet balance check succeeded against ${appConfig.tonApiBaseUrl}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "TON balance lookup failed.",
    };
  }
}

export async function verifyTonBalance(address: string, requiredTon: number) {
  const balance = await getTonAddressBalance(address);
  if (!balance.ok) {
    return balance;
  }

  const requiredNano = BigInt(toNanoString(requiredTon));
  const availableNano = BigInt(balance.balanceNano);

  if (availableNano < requiredNano) {
    return {
      ok: false as const,
      error: `Wallet balance is too low. Need ${requiredTon} TON, available ${balance.balanceTon.toFixed(3)} TON.`,
    };
  }

  return {
    ok: true as const,
    balanceNano: balance.balanceNano,
    balanceTon: balance.balanceTon,
    statusMessage: `Wallet balance check passed with ${balance.balanceTon.toFixed(3)} TON available.`,
  };
}
