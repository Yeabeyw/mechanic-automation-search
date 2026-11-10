import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getFirebaseDb,
  getFirebaseFunctions,
  isFirebaseMutationsEnabled,
} from "@/integrations/firebase/client";
import type { LedgerBlock } from "@/lib/ledger";
import type { AppRole } from "@/lib/auth";
import type { Mechanic, RequestStatus, ServiceRequest, Review } from "@/lib/mechanics";

export type CustomerRequest = ServiceRequest & {
  mechanics: Pick<Mechanic, "name" | "workshop" | "town" | "code"> | null;
  reviews: Pick<Review, "id"> | null;
};

export type AdminRequest = Pick<ServiceRequest, "id" | "ref" | "category" | "status" | "created_at"> & {
  mechanics: Pick<Mechanic, "name"> | null;
};

function rowFromSnapshot<T>(snapshot: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

async function callFunction<Input, Output>(name: string, input: Input): Promise<Output> {
  if (!isFirebaseMutationsEnabled()) {
    throw new Error(
      "AutoHelp is in read-only mode. Secure account changes and app updates require deployed Firebase Cloud Functions; enable them only after the project can deploy Functions.",
    );
  }
  const result = await httpsCallable<Input, Output>(getFirebaseFunctions(), name)(input);
  return result.data;
}

export async function ensureUserProfile(fullName?: string) {
  return callFunction<{ fullName?: string }, { roles: AppRole[] }>("ensureUserProfile", {
    ...(fullName ? { fullName } : {}),
  });
}

export async function listVerifiedMechanics(): Promise<Mechanic[]> {
  const result = await getDocs(
    query(collection(getFirebaseDb(), "mechanics"), where("verified", "==", true)),
  );
  return result.docs.map((snapshot) => rowFromSnapshot<Mechanic>(snapshot))
    .sort((a, b) => b.rating - a.rating);
}

export async function getMechanic(id: string): Promise<Mechanic | null> {
  const result = await getDoc(doc(getFirebaseDb(), "mechanics", id));
  return result.exists() ? ({ id: result.id, ...result.data() } as Mechanic) : null;
}

export async function getMechanicForUser(userId: string): Promise<Mechanic | null> {
  const owner = await getDoc(doc(getFirebaseDb(), "mechanic_owners", userId));
  if (!owner.exists()) return null;
  const mechanicId: unknown = owner.data()["mechanic_id"];
  if (typeof mechanicId !== "string") {
    throw new Error("The mechanic ownership record is invalid.");
  }
  return getMechanic(mechanicId);
}

export async function getMechanicsForAdmin(): Promise<Mechanic[]> {
  const result = await getDocs(
    query(collection(getFirebaseDb(), "mechanics"), orderBy("created_at", "desc")),
  );
  return result.docs.map((snapshot) => rowFromSnapshot<Mechanic>(snapshot));
}

export async function getMechanicReviews(mechanicId: string) {
  const result = await getDocs(
    query(
      collection(getFirebaseDb(), "reviews"),
      where("mechanic_id", "==", mechanicId),
      orderBy("created_at", "desc"),
    ),
  );
  return result.docs.map((snapshot) => rowFromSnapshot<Review>(snapshot));
}

export async function getCustomerRequests(customerId: string): Promise<CustomerRequest[]> {
  const result = await getDocs(
    query(
      collection(getFirebaseDb(), "service_requests"),
      where("customer_id", "==", customerId),
      orderBy("created_at", "desc"),
    ),
  );
  const requests = result.docs.map((snapshot) => rowFromSnapshot<ServiceRequest>(snapshot));
  const mechanicIds = [...new Set(requests.map((request) => request.mechanic_id))];
  const mechanics = await Promise.all(mechanicIds.map(async (id) => [id, await getMechanic(id)] as const));
  const mechanicsById = new Map(mechanics);
  const reviews = await Promise.all(
    requests.map(async (request) => {
      const review = await getDoc(doc(getFirebaseDb(), "reviews", request.id));
      return [request.id, review.exists() ? { id: review.id } : null] as const;
    }),
  );
  const reviewsByRequest = new Map(reviews);

  return requests.map((request) => {
    const mechanic = mechanicsById.get(request.mechanic_id);
    return {
      ...request,
      mechanics: mechanic
        ? { name: mechanic.name, workshop: mechanic.workshop, town: mechanic.town, code: mechanic.code }
        : null,
      reviews: reviewsByRequest.get(request.id) ?? null,
    };
  });
}

export async function getMechanicRequests(mechanicOwnerId: string): Promise<ServiceRequest[]> {
  const result = await getDocs(
    query(
      collection(getFirebaseDb(), "service_requests"),
      where("mechanic_owner_id", "==", mechanicOwnerId),
      orderBy("created_at", "desc"),
    ),
  );
  return result.docs.map((snapshot) => rowFromSnapshot<ServiceRequest>(snapshot));
}

export async function getAdminRequests(): Promise<AdminRequest[]> {
  const result = await getDocs(
    query(collection(getFirebaseDb(), "service_requests"), orderBy("created_at", "desc"), limit(50)),
  );
  const requests = result.docs.map((snapshot) => rowFromSnapshot<ServiceRequest>(snapshot));
  const mechanicIds = [...new Set(requests.map((request) => request.mechanic_id))];
  const mechanics = await Promise.all(mechanicIds.map(async (id) => [id, await getMechanic(id)] as const));
  const mechanicsById = new Map(mechanics);
  return requests.map((request) => ({
    id: request.id,
    ref: request.ref,
    category: request.category,
    status: request.status,
    created_at: request.created_at,
    mechanics: mechanicsById.get(request.mechanic_id)
      ? { name: mechanicsById.get(request.mechanic_id)!.name }
      : null,
  }));
}

export async function updateMyProfile(fullName: string) {
  return callFunction<{ fullName: string }, { ok: boolean }>("updateMyProfile", { fullName });
}

/** Everything the app holds about one user, for the GDPR access/portability download. */
export async function exportMyData(uid: string): Promise<Record<string, unknown>> {
  const db = getFirebaseDb();
  const profile = await getDoc(doc(db, "users", uid));

  const sent = await getDocs(
    query(collection(db, "service_requests"), where("customer_id", "==", uid)),
  );
  const requestsSent = sent.docs.map((snapshot) => rowFromSnapshot<ServiceRequest>(snapshot));
  const reviewSnapshots = await Promise.all(
    requestsSent.map((request) => getDoc(doc(db, "reviews", request.id))),
  );
  const reviewsWritten = reviewSnapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));

  const mechanic = await getMechanicForUser(uid);
  const received = await getDocs(
    query(collection(db, "service_requests"), where("mechanic_owner_id", "==", uid)),
  );
  const requestsReceived = received.docs.map((snapshot) => rowFromSnapshot<ServiceRequest>(snapshot));
  const reviewsReceived = mechanic ? await getMechanicReviews(mechanic.id) : [];

  return {
    profile: profile.exists() ? profile.data() : null,
    mechanic_profile: mechanic,
    requests_sent: requestsSent,
    reviews_written: reviewsWritten,
    requests_received_as_mechanic: requestsReceived,
    reviews_received_as_mechanic: reviewsReceived,
    ledger_note:
      "The public ledger stores only salted SHA-256 fingerprints and non-personal metadata about your records, not your personal data.",
  };
}

export async function setMechanicAvailability(available: boolean) {
  return callFunction<{ available: boolean }, void>("setMechanicAvailability", { available });
}

export async function submitMechanicApplication(input: {
  name: string;
  workshop: string;
  town: string;
  experience_years: number;
  specialties: string[];
  bio: string;
}) {
  return callFunction<typeof input, { id: string }>("submitMechanicApplication", input);
}

export async function createServiceRequest(input: {
  mechanic_id: string;
  category: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  description: string;
  contact_phone: string | null;
}) {
  return callFunction<typeof input, { id: string; ref: string }>("createServiceRequest", input);
}

export async function cancelServiceRequest(id: string) {
  return callFunction<{ id: string }, void>("cancelServiceRequest", { id });
}

export async function updateServiceRequestStatus(id: string, status: RequestStatus) {
  return callFunction<{ id: string; status: RequestStatus }, void>("updateServiceRequestStatus", {
    id,
    status,
  });
}

export async function submitReview(input: {
  request_id: string;
  mechanic_id: string;
  rating: number;
  comment: string;
}) {
  return callFunction<typeof input, { id: string }>("submitReview", input);
}

export async function verifyMechanic(id: string) {
  return callFunction<{ id: string }, void>("verifyMechanic", { id });
}

export async function getLedgerBlocks(): Promise<LedgerBlock[]> {
  const db = getFirebaseDb();
  const blocks: LedgerBlock[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  for (;;) {
    const constraints = [orderBy("block_index", "asc"), limit(500)];
    const result = await getDocs(
      query(
        collection(db, "ledger_blocks"),
        ...constraints,
        ...(cursor ? [startAfter(cursor)] : []),
      ),
    );
    blocks.push(...result.docs.map((snapshot) => rowFromSnapshot<LedgerBlock>(snapshot)));
    if (result.docs.length < 500) return blocks;
    cursor = result.docs.at(-1);
    if (!cursor) return blocks;
  }
}

export async function getLedgerBlocksForRecord(recordRef: string): Promise<LedgerBlock[]> {
  const result = await getDocs(
    query(
      collection(getFirebaseDb(), "ledger_blocks"),
      where("record_ref", "==", recordRef),
      orderBy("block_index", "asc"),
    ),
  );
  return result.docs.map((snapshot) => rowFromSnapshot<LedgerBlock>(snapshot));
}

export async function getLatestLedgerBlocks(count: number): Promise<LedgerBlock[]> {
  const result = await getDocs(
    query(
      collection(getFirebaseDb(), "ledger_blocks"),
      orderBy("block_index", "desc"),
      limit(count),
    ),
  );
  return result.docs.map((snapshot) => rowFromSnapshot<LedgerBlock>(snapshot));
}

export async function verifyLedgerRecord(recordRef: string, recordType: "mechanic" | "service_request") {
  return callFunction<
    { recordRef: string; recordType: "mechanic" | "service_request" },
    { ok: boolean }
  >("verifyLedgerRecord", { recordRef, recordType });
}
