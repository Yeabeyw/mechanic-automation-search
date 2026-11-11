const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, serverTimestamp, setDoc, updateDoc } = require("firebase/firestore");

const projectId = "demo-autohelp-rules";
const rules = fs.readFileSync(path.join(__dirname, "firestore.rules"), "utf8");
const policy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "functions", "src", "security-policy.json"), "utf8"),
);

let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

test.after(async () => {
  await environment.cleanup();
});

test.beforeEach(async () => {
  await environment.clearFirestore();
});

async function seed(documents) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(
      documents.map(([collection, id, data]) => setDoc(doc(db, collection, id), data)),
    );
  });
}

function validCustomerProfile() {
  return {
    full_name: "Test Customer",
    email: "customer@example.com",
    roles: ["customer"],
    created_at: serverTimestamp(),
    consent: {
      accepted: true,
      accepted_at: serverTimestamp(),
      policy_version: "privacy-2026-03",
    },
  };
}

test("customer cannot read another customer's request", async () => {
  await seed([
    [
      "service_requests",
      "request-1",
      {
        customer_id: "customer-2",
        mechanic_owner_id: "mechanic-1",
      },
    ],
  ]);
  const db = environment.authenticatedContext("customer-1").firestore();
  await assertFails(getDoc(doc(db, "service_requests", "request-1")));
});

test("business Admin cannot read Security Admin audit logs", async () => {
  await seed([
    ["users", "business-admin", { roles: ["admin"] }],
    ["security_audit", "audit-1", { action: "test", result: "Allowed" }],
  ]);
  const db = environment.authenticatedContext("business-admin").firestore();
  await assertFails(getDoc(doc(db, "security_audit", "audit-1")));
});

test("mechanic cannot read service-request documents directly", async () => {
  await seed([
    ["mechanic_owners", "mechanic-1", { user_id: "mechanic-1" }],
    ["mechanics", "mechanic-1", { verified: true, available: true }],
    [
      "service_requests",
      "assigned-request",
      {
        customer_id: "customer-1",
        mechanic_id: "mechanic-1",
        mechanic_owner_id: "mechanic-1",
        status: "accepted",
      },
    ],
    [
      "service_requests",
      "pool-request",
      {
        customer_id: "customer-2",
        mechanic_id: "",
        mechanic_owner_id: "",
        status: "sent",
      },
    ],
  ]);
  const db = environment.authenticatedContext("mechanic-1").firestore();
  await assertFails(getDoc(doc(db, "service_requests", "assigned-request")));
  await assertFails(getDoc(doc(db, "service_requests", "pool-request")));
});

test("mechanic can read request details only after accepting and while verified", async () => {
  await seed([
    ["mechanic_owners", "mechanic-1", { user_id: "mechanic-1" }],
    ["mechanics", "mechanic-1", { verified: true, status: "verified" }],
    [
      "service_requests",
      "request-1",
      {
        customer_id: "customer-1",
        mechanic_id: "mechanic-1",
        mechanic_owner_id: "mechanic-1",
        status: "sent",
      },
    ],
    [
      "service_request_private",
      "request-1",
      {
        customer_id: "customer-1",
        mechanic_owner_id: "mechanic-1",
        description: "Private repair details",
        contact_phone: "+26600000000",
      },
    ],
  ]);
  const db = environment.authenticatedContext("mechanic-1").firestore();
  await assertFails(getDoc(doc(db, "service_request_private", "request-1")));

  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "service_requests", "request-1"), {
      status: "accepted",
    });
  });
  await assertSucceeds(getDoc(doc(db, "service_request_private", "request-1")));

  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "mechanics", "mechanic-1"), {
      verified: false,
      status: "suspended",
    });
  });
  await assertFails(getDoc(doc(db, "service_request_private", "request-1")));
});

test("mechanic cannot set verified=true from a client", async () => {
  await seed([
    ["users", "mechanic-user", { roles: ["mechanic"] }],
    ["mechanic_owners", "mechanic-1", { user_id: "mechanic-user" }],
    ["mechanics", "mechanic-1", { verified: false }],
  ]);
  const db = environment.authenticatedContext("mechanic-user").firestore();
  await assertFails(updateDoc(doc(db, "mechanics", "mechanic-1"), { verified: true }));
});

test("Security Admin can read audit logs but not business requests", async () => {
  await seed([
    ["users", "security-admin", { roles: ["security_admin"] }],
    ["users", "customer-1", { full_name: "Customer One", email: "customer@example.com" }],
    ["security_audit", "audit-1", { action: "test", result: "Allowed" }],
    ["service_requests", "request-1", { customer_id: "customer-1" }],
  ]);
  const db = environment.authenticatedContext("security-admin").firestore();
  await assertSucceeds(getDoc(doc(db, "security_audit", "audit-1")));
  await assertSucceeds(getDoc(doc(db, "users", "security-admin")));
  await assertFails(getDoc(doc(db, "users", "customer-1")));
  await assertFails(getDoc(doc(db, "service_requests", "request-1")));
});

test("anyone can read anonymised AI dataset; only signed-in users can read models; clients cannot write them", async () => {
  await seed([
    ["ai_dataset", "current", { size: 1, records: [{ id: "SYN-0001", successful_match: 1 }] }],
    ["ai_models", "latest", { best_model: "forest" }],
  ]);
  const anon = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anon, "ai_dataset", "current")));
  await assertFails(getDoc(doc(anon, "ai_models", "latest")));
  const customer = environment.authenticatedContext("customer-1").firestore();
  await assertSucceeds(getDoc(doc(customer, "ai_models", "latest")));
  await assertFails(setDoc(doc(customer, "ai_models", "latest"), { best_model: "baseline" }));
});

test("public users can read verified mechanics and public ledger proofs", async () => {
  await seed([
    ["mechanics", "verified-mechanic", { verified: true }],
    ["ledger_blocks", "public-proof", { block_hash: "test-hash" }],
  ]);
  const db = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "mechanics", "verified-mechanic")));
  await assertSucceeds(getDoc(doc(db, "ledger_blocks", "public-proof")));
});

test("authenticated users can create only their own consented customer profile", async () => {
  const db = environment
    .authenticatedContext("customer-1", {
      email: "customer@example.com",
    })
    .firestore();
  await assertSucceeds(setDoc(doc(db, "users", "customer-1"), validCustomerProfile()));
  await assertFails(
    setDoc(doc(db, "service_requests", "request-1"), { customer_id: "customer-1" }),
  );
  await assertFails(getDoc(doc(db, "unknown_collection", "record-1")));
});

test("users cannot create profiles with elevated roles or another email", async () => {
  const db = environment
    .authenticatedContext("customer-1", {
      email: "customer@example.com",
    })
    .firestore();
  await assertFails(
    setDoc(doc(db, "users", "customer-1"), {
      ...validCustomerProfile(),
      roles: ["admin"],
    }),
  );
  await assertFails(
    setDoc(doc(db, "users", "customer-1"), {
      ...validCustomerProfile(),
      email: "someone-else@example.com",
    }),
  );
});

test("profile creation requires explicit consent and cannot be overwritten", async () => {
  const db = environment
    .authenticatedContext("customer-1", {
      email: "customer@example.com",
    })
    .firestore();
  const profile = validCustomerProfile();
  profile.consent.accepted = false;
  await assertFails(setDoc(doc(db, "users", "customer-1"), profile));
  await assertSucceeds(setDoc(doc(db, "users", "customer-1"), validCustomerProfile()));
  await assertFails(updateDoc(doc(db, "users", "customer-1"), { full_name: "Changed" }));
});

test("unauthenticated users cannot create user profiles", async () => {
  const db = environment.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "users", "customer-1"), validCustomerProfile()));
});

test("shared permission matrix agrees with critical Firestore rule predicates", () => {
  const permission = (actor, module) =>
    policy.permissions.find((entry) => entry.actor === actor && entry.module === module);
  assert.equal(permission("Customer", "service_requests").read, "Own");
  assert.equal(permission("Mechanic", "service_requests").read, "Callable redacted inbox");
  assert.equal(permission("Visitor", "mechanics").read, "Verified only");
  assert.equal(permission("Admin", "security_audit").read, "None");
  assert.equal(permission("Security Admin", "users").read, "Own");
  assert.equal(permission("Security Admin", "service_requests").read, "None");
  assert.match(rules, /resource\.data\.customer_id == request\.auth\.uid/);
  assert.match(rules, /get\(requestPath\)\.data\.mechanic_owner_id == request\.auth\.uid/);
  assert.match(
    rules,
    /match \/service_requests\/\{requestId\}[\s\S]*?allow get: if isAdmin\(\)\s*\|\|\s*\(isSignedIn\(\) && resource\.data\.customer_id == request\.auth\.uid\);/,
  );
  assert.match(rules, /resource\.data\.verified == true/);
  assert.match(
    rules,
    /match \/security_audit\/\{auditId\}[\s\S]*?allow get: if isSecurityAdmin\(\)/,
  );
  assert.match(
    rules,
    /match \/\{document=\*\*\}[\s\S]*?allow get, list, create, update, delete: if false/,
  );
});
