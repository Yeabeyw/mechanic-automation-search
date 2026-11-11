import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getFirebaseAuth,
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

export type MechanicInboxRequest = Pick<
  ServiceRequest,
  | "id"
  | "category"
  | "created_at"
  | "mechanic_id"
  | "mechanic_owner_id"
  | "ref"
  | "status"
  | "updated_at"
> &
  Partial<
    Pick<
      ServiceRequest,
      | "contact_phone"
      | "customer_name"
      | "description"
      | "status_history"
      | "vehicle_make"
      | "vehicle_model"
      | "vehicle_year"
    >
  > & { returned_to_pool: boolean };

export type AdminRequest = Pick<
  ServiceRequest,
  "id" | "ref" | "category" | "status" | "created_at" | "mechanic_id"
> & {
  mechanics: Pick<Mechanic, "name" | "verified" | "available"> | null;
  description?: string;
  contact_phone?: string | null;
};

export type AppUser = {
  uid: string;
  full_name: string;
  roles: AppRole[];
  mechanic_profile: boolean;
};

export type Vehicle = { make: string; model: string; year: number | null };

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

export async function ensureUserProfile(fullName?: string, consentAccepted = false) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Sign in before creating your user profile.");

  const profileRef = doc(getFirebaseDb(), "users", user.uid);
  return runTransaction(getFirebaseDb(), async (transaction) => {
    const profile = await transaction.get(profileRef);
    if (profile.exists()) {
      const roles: unknown = profile.data()["roles"];
      if (
        !Array.isArray(roles) ||
        !roles.every(
          (role) =>
            role === "customer" ||
            role === "admin" ||
            role === "security_admin" ||
            role === "mechanic",
        )
      ) {
        throw new Error("Your Firebase user profile has invalid role data.");
      }
      return { roles: roles.filter((role): role is AppRole => role !== "mechanic") };
    }
    if (!consentAccepted) {
      throw new Error("Accept the Privacy Policy to finish creating your account.");
    }
    if (!user.email) {
      throw new Error("A verified email address is required to create an AutoHelp profile.");
    }

    transaction.set(profileRef, {
      full_name: (fullName ?? user.displayName ?? "").trim().slice(0, 100),
      email: user.email,
      roles: ["customer"],
      created_at: serverTimestamp(),
      consent: {
        accepted: true,
        accepted_at: serverTimestamp(),
        policy_version: "privacy-2026-03",
      },
    });
    return { roles: ["customer"] as AppRole[] };
  });
}

export async function recordDataExport() {
  return callFunction<Record<string, never>, { ok: true }>("recordDataExport", {});
}

export async function deleteMyAccount() {
  return callFunction<Record<string, never>, { ok: true }>("deleteUser", {});
}

export async function listVerifiedMechanics(): Promise<Mechanic[]> {
  const result = await getDocs(
    query(collection(getFirebaseDb(), "mechanics"), where("verified", "==", true)),
  );
  return result.docs
    .map((snapshot) => rowFromSnapshot<Mechanic>(snapshot))
    .filter((mechanic) => mechanic.available)
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
  return Promise.all(
    result.docs.map(async (snapshot) => {
      const privateProfile = await getDoc(doc(getFirebaseDb(), "mechanic_private", snapshot.id));
      return {
        ...rowFromSnapshot<Mechanic>(snapshot),
        id_reference: privateProfile.exists()
          ? String(privateProfile.data()["id_reference"] ?? "")
          : null,
      };
    }),
  );
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
  const requests = await Promise.all(
    result.docs.map(async (snapshot) => {
      const privateRequest = await getDoc(
        doc(getFirebaseDb(), "service_request_private", snapshot.id),
      );
      return {
        ...rowFromSnapshot<ServiceRequest>(snapshot),
        ...(privateRequest.exists() ? privateRequest.data() : {}),
        returned_to_pool:
          !snapshot.data()["mechanic_owner_id"] &&
          Array.isArray(snapshot.data()["status_history"]) &&
          snapshot
            .data()
            ["status_history"].some(
              (event: unknown) =>
                typeof event === "object" &&
                event !== null &&
                "status" in event &&
                event.status === "declined",
            ),
      } as ServiceRequest;
    }),
  );
  const mechanicIds = [...new Set(requests.map((request) => request.mechanic_id).filter(Boolean))];
  const mechanics = await Promise.all(
    mechanicIds.map(async (id) => [id, await getMechanic(id)] as const),
  );
  const mechanicsById = new Map(mechanics);
  const reviews = await Promise.all(
    requests.map(async (request) => {
      const review = await getDoc(doc(getFirebaseDb(), "reviews", request.id));
      return [request.id, review.exists() ? { id: review.id } : null] as const;
    }),
  );
  const reviewsByRequest = new Map(reviews);

  return requests.map((request) => {
    const mechanic = request.mechanic_id ? mechanicsById.get(request.mechanic_id) : null;
    return {
      ...request,
      mechanics: mechanic
        ? {
            name: mechanic.name,
            workshop: mechanic.workshop,
            town: mechanic.town,
            code: mechanic.code,
          }
        : null,
      reviews: reviewsByRequest.get(request.id) ?? null,
    };
  });
}

export async function getMechanicRequests(
  mechanicOwnerId: string,
): Promise<MechanicInboxRequest[]> {
  if (getFirebaseAuth().currentUser?.uid !== mechanicOwnerId) {
    throw new Error("You can only load your own mechanic workspace.");
  }
  const { requests } = await callFunction<
    Record<string, never>,
    { requests: MechanicInboxRequest[] }
  >("getMechanicInbox", {});
  return requests;
}

export async function getAdminRequests(): Promise<AdminRequest[]> {
  const result = await getDocs(
    query(
      collection(getFirebaseDb(), "service_requests"),
      orderBy("created_at", "desc"),
      limit(50),
    ),
  );
  const requests = await Promise.all(
    result.docs.map(async (snapshot) => {
      const privateRequest = await getDoc(
        doc(getFirebaseDb(), "service_request_private", snapshot.id),
      );
      return {
        ...rowFromSnapshot<ServiceRequest>(snapshot),
        ...(privateRequest.exists() ? privateRequest.data() : {}),
      } as ServiceRequest;
    }),
  );
  const mechanicIds = [...new Set(requests.map((request) => request.mechanic_id).filter(Boolean))];
  const mechanics = await Promise.all(
    mechanicIds.map(async (id) => [id, await getMechanic(id)] as const),
  );
  const mechanicsById = new Map(mechanics);
  return requests.map((request) => ({
    id: request.id,
    ref: request.ref,
    category: request.category,
    status: request.status,
    created_at: request.created_at,
    mechanic_id: request.mechanic_id,
    description: request.description,
    contact_phone: request.contact_phone,
    mechanics: mechanicsById.get(request.mechanic_id)
      ? {
          name: mechanicsById.get(request.mechanic_id)!.name,
          verified: mechanicsById.get(request.mechanic_id)!.verified,
          available: mechanicsById.get(request.mechanic_id)!.available,
        }
      : null,
  }));
}

export async function getAdminUsers(): Promise<AppUser[]> {
  const [users, mechanicOwners] = await Promise.all([
    getDocs(query(collection(getFirebaseDb(), "users"), orderBy("full_name"), limit(200))),
    getDocs(collection(getFirebaseDb(), "mechanic_owners")),
  ]);
  const mechanicUids = new Set(
    mechanicOwners.docs.map((snapshot) => String(snapshot.data()["user_id"] ?? "")),
  );
  return users.docs.map((snapshot) => ({
    uid: snapshot.id,
    full_name: String(snapshot.data()["full_name"] ?? ""),
    roles: Array.isArray(snapshot.data()["roles"])
      ? snapshot
          .data()
          ["roles"].filter(
            (role: unknown): role is AppRole =>
              role === "customer" || role === "admin" || role === "security_admin",
          )
      : [],
    mechanic_profile: mechanicUids.has(snapshot.id),
  }));
}

export async function updateMyProfile(fullName: string) {
  return callFunction<{ fullName: string }, { ok: boolean }>("updateMyProfile", { fullName });
}

export async function updateMyVehicles(
  vehicles: { make: string; model: string; year: number | null }[],
) {
  return callFunction<{ vehicles: typeof vehicles }, { ok: boolean }>("updateMyVehicles", {
    vehicles,
  });
}

export async function getMyVehicles(uid: string): Promise<Vehicle[]> {
  const profile = await getDoc(doc(getFirebaseDb(), "users", uid));
  if (!profile.exists()) return [];
  const vehicles: unknown = profile.data()["vehicles"];
  if (!Array.isArray(vehicles)) return [];
  return vehicles.filter(
    (vehicle): vehicle is Vehicle =>
      typeof vehicle === "object" &&
      vehicle !== null &&
      "make" in vehicle &&
      typeof vehicle.make === "string" &&
      "model" in vehicle &&
      typeof vehicle.model === "string" &&
      "year" in vehicle &&
      (typeof vehicle.year === "number" || vehicle.year === null),
  );
}

/** Everything the app holds about one user, for the GDPR access/portability download. */
export async function exportMyData(uid: string): Promise<Record<string, unknown>> {
  const db = getFirebaseDb();
  const profile = await getDoc(doc(db, "users", uid));

  const sent = await getDocs(
    query(collection(db, "service_requests"), where("customer_id", "==", uid)),
  );
  const requestsSent = await Promise.all(
    sent.docs.map(async (snapshot) => {
      const privateRequest = await getDoc(doc(db, "service_request_private", snapshot.id));
      return {
        ...rowFromSnapshot<ServiceRequest>(snapshot),
        ...(privateRequest.exists() ? privateRequest.data() : {}),
      } as ServiceRequest;
    }),
  );
  const reviewSnapshots = await Promise.all(
    requestsSent.map((request) => getDoc(doc(db, "reviews", request.id))),
  );
  const reviewsWritten = reviewSnapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));

  const mechanic = await getMechanicForUser(uid);
  const requestsReceived = mechanic ? await getMechanicRequests(uid) : [];
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
  id_reference: string;
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

export async function suspendMechanic(id: string) {
  return callFunction<{ id: string }, void>("suspendMechanic", { id });
}

export async function reassignServiceRequest(id: string, mechanicId: string) {
  return callFunction<{ id: string; mechanic_id: string }, void>("reassignServiceRequest", {
    id,
    mechanic_id: mechanicId,
  });
}

export async function publishAiDataset(input: {
  records: unknown[];
  n_synthetic: number;
  n_real: number;
}) {
  return callFunction<typeof input, { ok: true; size: number }>("publishAiDataset", input);
}

export async function publishAiModels(input: {
  bundle: unknown;
  dataset_size: number;
  trained_at: string;
  best_model: string;
}) {
  return callFunction<typeof input, { ok: true }>("publishAiModels", input);
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

export async function verifyLedgerRecord(
  recordRef: string,
  recordType: "mechanic" | "service_request",
) {
  return callFunction<
    { recordRef: string; recordType: "mechanic" | "service_request" },
    { ok: boolean }
  >("verifyLedgerRecord", { recordRef, recordType });
}
