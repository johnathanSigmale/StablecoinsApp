import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

// Extra TON the buyer sends on top of the price to cover gas for both
// a potential refund and the final release (two outgoing transactions).
export const ESCROW_GAS_BUFFER_TON = 0.05;

function getTonClient() {
  const base = process.env.TON_API_BASE_URL || "https://testnet.toncenter.com/api/v2";
  const endpoint = `${base}/jsonRPC`;
  const apiKey = process.env.TON_API_KEY;
  return new TonClient({ endpoint, apiKey });
}

export function getEscrowWalletAddress(): string | null {
  return process.env.ESCROW_WALLET_ADDRESS || null;
}

export function hasEscrowWallet(): boolean {
  return Boolean(process.env.ESCROW_WALLET_MNEMONIC && process.env.ESCROW_WALLET_ADDRESS);
}

async function openEscrowWallet() {
  const mnemonic = process.env.ESCROW_WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error("ESCROW_WALLET_MNEMONIC is not configured.");
  }

  const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const contract = getTonClient().open(wallet);
  return { contract, keyPair };
}

export async function transferFromEscrow(toAddress: string, amountTon: number): Promise<string> {
  const { contract, keyPair } = await openEscrowWallet();
  const seqno = await contract.getSeqno();
  const amountNano = BigInt(Math.round(amountTon * 1_000_000_000));

  await contract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: toAddress,
        value: amountNano,
        bounce: false,
      }),
    ],
  });

  return `escrow:seqno:${seqno}`;
}
