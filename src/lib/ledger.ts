// Client-side verification of the AutoHelp hash-chain ledger.
// Rules (must match appendLedgerEvent in functions/src/ledger.ts):
//   data_hash  = SHA-256(payload)
//   record_hash = SHA-256(private salt hex + "|" + canonical record)
//   block_hash = SHA-256(`${block_index}|${prev_hash}|${data_hash}|${ts}`)
//   prev_hash  = block_hash of the previous block (64 zeros for genesis)

export type LedgerBlock = {
  block_index: number;
  ts: number;
  event_type: string;
  record_type: string;
  record_ref: string;
  payload: string;
  data_hash: string;
  record_hash: string | null;
  prev_hash: string;
  block_hash: string;
  network: string;
  created_at: string;
  tx_hash?: string | null;
  block_number?: number | null;
  contract_address?: string | null;
};

export const GENESIS_PREV = "0".repeat(64);

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function blockHashInput(b: Pick<LedgerBlock, "block_index" | "prev_hash" | "data_hash" | "ts">) {
  return `${b.block_index}|${b.prev_hash}|${b.data_hash}|${b.ts}`;
}

export type BlockCheck = {
  index: number;
  dataHashOk: boolean;
  blockHashOk: boolean;
  linkOk: boolean;
  ok: boolean;
};

export type RecordSnapshot =
  | {
      type: "mechanic";
      ref: string;
      name: string;
      workshop: string;
      town: string;
      specialties: string[];
      experienceYears: number;
      verified: boolean;
    }
  | {
      type: "service_request";
      ref: string;
      category: string;
      mechanicCode: string | null;
      status: string;
      vehicleMake: string;
      vehicleModel: string;
      vehicleYear: number | null;
      description: string;
      contactPhone: string | null;
    };

function fingerprintField(value: string | null): string {
  if (value === null) return "~";
  return Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalRecord(snapshot: RecordSnapshot): string {
  if (snapshot.type === "mechanic") {
    const specialties = snapshot.specialties.map((value) => fingerprintField(value)).join(",");
    return [
      "autohelp:v1",
      "mechanic",
      fingerprintField(snapshot.ref),
      fingerprintField(snapshot.name),
      fingerprintField(snapshot.workshop),
      fingerprintField(snapshot.town),
      specialties,
      fingerprintField(String(snapshot.experienceYears)),
      fingerprintField(String(snapshot.verified)),
    ].join("|");
  }

  return [
    "autohelp:v1",
    "service_request",
    fingerprintField(snapshot.ref),
    fingerprintField(snapshot.category),
    fingerprintField(snapshot.mechanicCode),
    fingerprintField(snapshot.status),
    fingerprintField(snapshot.vehicleMake),
    fingerprintField(snapshot.vehicleModel),
    fingerprintField(snapshot.vehicleYear === null ? null : String(snapshot.vehicleYear)),
    fingerprintField(snapshot.description),
    fingerprintField(snapshot.contactPhone),
  ].join("|");
}

export function fingerprintRecord(snapshot: RecordSnapshot, salt: string): Promise<string> {
  return sha256Hex(`${salt}|${canonicalRecord(snapshot)}`);
}

function payloadOf(block: LedgerBlock): Record<string, unknown> | null {
  try {
    const payload: unknown = JSON.parse(block.payload);
    return typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function verifyRecordSnapshot(
  blocks: LedgerBlock[],
  snapshot: RecordSnapshot,
  fingerprintSalt: string,
): Promise<boolean> {
  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index);
  if (sorted.length === 0) return false;
  if (
    sorted.some(
      (block) => block.record_ref !== snapshot.ref || block.record_type !== snapshot.type,
    )
  ) {
    return false;
  }

  const latest = sorted.at(-1);
  if (!latest?.record_hash || latest.event_type.endsWith("_DELETED")) return false;
  const payload = payloadOf(latest);
  if (payload?.["recordHash"] !== latest.record_hash) return false;

  if (snapshot.type === "mechanic") {
    return (
      latest.event_type.startsWith("MECHANIC_") &&
      payload?.["verified"] === snapshot.verified &&
      (await fingerprintRecord(snapshot, fingerprintSalt)) === latest.record_hash
    );
  }

  const validEvent =
    latest.event_type === `REQUEST_${snapshot.status.toUpperCase()}` ||
    latest.event_type === "REQUEST_UPDATED";
  return (
    validEvent &&
    payload?.["status"] === snapshot.status &&
    (await fingerprintRecord(snapshot, fingerprintSalt)) === latest.record_hash
  );
}

export async function verifyBlock(b: LedgerBlock, prev?: LedgerBlock | null): Promise<BlockCheck> {
  const dataHashOk = (await sha256Hex(b.payload)) === b.data_hash;
  const blockHashOk = (await sha256Hex(blockHashInput(b))) === b.block_hash;
  const expectedPrev = b.block_index === 0 ? GENESIS_PREV : prev?.block_hash;
  const linkOk = expectedPrev !== undefined && b.prev_hash === expectedPrev;
  return { index: b.block_index, dataHashOk, blockHashOk, linkOk, ok: dataHashOk && blockHashOk && linkOk };
}

export async function verifyChain(blocks: LedgerBlock[]): Promise<BlockCheck[]> {
  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index);
  const out: BlockCheck[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]!.block_index !== sorted[i - 1]!.block_index + 1) {
      out.push({ index: sorted[i]!.block_index, dataHashOk: false, blockHashOk: false, linkOk: false, ok: false });
      continue;
    }
    out.push(await verifyBlock(sorted[i]!, i > 0 ? sorted[i - 1] : null));
  }
  return out;
}

export const short = (h: string, n = 6) => `${h.slice(0, n)}…${h.slice(-4)}`;
