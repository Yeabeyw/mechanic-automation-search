// Firestore Rules Tests for AutoHelp Lesotho
// Run with: firebase emulators:start --only firestore
// Then: firebase emulators:exec "mocha firestore.rules.test.js"

const { assert, expect } = require("chai");
const firebase = require("@firebase/testing");

const PROJECT_ID = "lesotho-digital-trust-test";
const RULES_PATH = "./firestore.rules";

describe("Firestore Security Rules", () => {
  let auth;
  let db;

  before(async () => {
    await firebase.loadFirestoreRules({
      projectId: PROJECT_ID,
      rules: RULES_PATH,
    });
  });

  beforeEach(async () => {
    auth = null;
    db = firebase.initializeFirestore({ projectId: PROJECT_ID }).firestore();
    await firebase.clearFirestoreData({ projectId: PROJECT_ID });
  });

  after(async () => {
    await Promise.all(firebase.apps().map((app) => app.delete()));
  });

  // Helper function to create authenticated user
  function getAuth(uid, roles = []) {
    return {
      uid,
      token: {
        email: `${uid}@example.com`,
        firebase: {
          sign_in_provider: "password",
          identities: {},
          roles: roles,
        },
      },
    };
  }

  describe("Helper functions", () => {
    it("isSignedIn() should return true for authenticated user", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      const testDoc = db.collection("users").doc("user1");
      await firebase.assertFails(testDoc.get());
    });

    it("isSignedIn() should return false for unauthenticated user", async () => {
      const testDoc = db.collection("users").doc("user1");
      await firebase.assertFails(testDoc.get());
    });
  });

  describe("users collection", () => {
    const userId = "user123";
    const userData = {
      full_name: "Test User",
      email: "test@example.com",
      roles: ["customer"],
    };

    it("should allow user to read their own profile", async () => {
      auth = getAuth(userId);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("users").doc(userId).get());
    });

    it("should allow security_admin to read any user profile", async () => {
      auth = getAuth("admin1", ["security_admin"]);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("users").doc(userId).get());
    });

    it("should deny regular user from reading other users' profiles", async () => {
      auth = getAuth("otherUser");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("users").doc(userId).get());
    });

    it("should deny client-side create operations", async () => {
      auth = getAuth(userId);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("users").doc(userId).set(userData));
    });

    it("should deny client-side update operations", async () => {
      auth = getAuth(userId);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("users").doc(userId).update({ full_name: "Updated" }));
    });

    it("should deny client-side delete operations", async () => {
      auth = getAuth(userId);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("users").doc(userId).delete());
    });
  });

  describe("mechanics collection", () => {
    const mechanicId = "mech123";
    const mechanicData = {
      name: "Test Mechanic",
      workshop: "Test Workshop",
      town: "Maseru",
    };

    it("should allow authenticated users to list mechanics", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("mechanics").get());
    });

    it("should allow authenticated users to get a specific mechanic", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("mechanics").doc(mechanicId).get());
    });

    it("should deny unauthenticated users from listing mechanics", async () => {
      await firebase.assertFails(db.collection("mechanics").get());
    });

    it("should deny client-side create operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("mechanics").doc(mechanicId).set(mechanicData));
    });

    it("should deny client-side update operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("mechanics").doc(mechanicId).update({ name: "Updated" }));
    });

    it("should deny client-side delete operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("mechanics").doc(mechanicId).delete());
    });
  });

  describe("service_requests collection", () => {
    const requestId = "req123";
    const requestData = {
      customer_uid: "user123",
      mechanic_id: "mech123",
      category: "Engine",
      status: "sent",
    };

    it("should allow user to read their own requests", async () => {
      auth = getAuth("user123");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(
        db.collection("service_requests").where("customer_uid", "==", "user123").get()
      );
    });

    it("should allow mechanic to read requests assigned to them", async () => {
      auth = getAuth("mech123", ["mechanic"]);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(
        db.collection("service_requests").where("mechanic_id", "==", "mech123").get()
      );
    });

    it("should deny security_admin from reading service requests", async () => {
      auth = getAuth("admin1", ["security_admin"]);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("service_requests").get());
    });

    it("should deny client-side create operations", async () => {
      auth = getAuth("user123");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("service_requests").doc(requestId).set(requestData));
    });
  });

  describe("reviews collection", () => {
    const reviewId = "review123";
    const reviewData = {
      mechanic_id: "mech123",
      customer_uid: "user123",
      rating: 5,
      comment: "Great service",
    };

    it("should allow authenticated users to list reviews", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("reviews").get());
    });

    it("should deny client-side create operations", async () => {
      auth = getAuth("user123");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("reviews").doc(reviewId).set(reviewData));
    });
  });

  describe("ledger_blocks collection", () => {
    const blockId = "block123";
    const blockData = {
      hash: "abc123",
      previous_hash: "def456",
      timestamp: 1234567890,
    };

    it("should allow authenticated users to list ledger blocks", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("ledger_blocks").get());
    });

    it("should allow authenticated users to get a specific block", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("ledger_blocks").doc(blockId).get());
    });

    it("should deny client-side create operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("ledger_blocks").doc(blockId).set(blockData));
    });
  });

  describe("ledger_secrets collection", () => {
    const secretId = "secret123";

    it("should deny all client-side read operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("ledger_secrets").get());
      await firebase.assertFails(db.collection("ledger_secrets").doc(secretId).get());
    });

    it("should deny all client-side write operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("ledger_secrets").doc(secretId).set({ secret: "value" }));
      await firebase.assertFails(db.collection("ledger_secrets").doc(secretId).update({ secret: "value" }));
      await firebase.assertFails(db.collection("ledger_secrets").doc(secretId).delete());
    });

    it("should deny security_admin from reading ledger secrets", async () => {
      auth = getAuth("admin1", ["security_admin"]);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("ledger_secrets").get());
    });
  });

  describe("ledger_state collection", () => {
    const stateId = "state123";

    it("should deny all client-side read operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("ledger_state").get());
      await firebase.assertFails(db.collection("ledger_state").doc(stateId).get());
    });

    it("should deny all client-side write operations", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("ledger_state").doc(stateId).set({ state: "value" }));
    });
  });

  describe("security_audit collection", () => {
    const auditId = "audit123";
    const auditData = {
      actor_uid: "admin1",
      action: "setUserRole",
      target_uid: "user123",
      role_changed: "admin",
      result: "Allowed",
      timestamp: 1234567890,
      reason: "Granting admin role",
    };

    it("should allow security_admin to read audit entries", async () => {
      auth = getAuth("admin1", ["security_admin"]);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertSucceeds(db.collection("security_audit").get());
      await firebase.assertSucceeds(db.collection("security_audit").doc(auditId).get());
    });

    it("should deny regular users from reading audit entries", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("security_audit").get());
      await firebase.assertFails(db.collection("security_audit").doc(auditId).get());
    });

    it("should deny admin from reading audit entries", async () => {
      auth = getAuth("admin1", ["admin"]);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("security_audit").get());
    });

    it("should deny all client-side write operations", async () => {
      auth = getAuth("admin1", ["security_admin"]);
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("security_audit").doc(auditId).set(auditData));
      await firebase.assertFails(db.collection("security_audit").doc(auditId).update({ result: "Denied" }));
      await firebase.assertFails(db.collection("security_audit").doc(auditId).delete());
    });
  });

  describe("Default deny-all rule", () => {
    it("should deny access to non-existent collections", async () => {
      auth = getAuth("user1");
      const db = firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
      await firebase.assertFails(db.collection("non_existent").get());
    });
  });
});
