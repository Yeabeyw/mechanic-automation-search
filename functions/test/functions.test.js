// Cloud Functions Test Script for AutoHelp Lesotho
// This is a manual test script to verify Cloud Functions behavior
// Run with: node functions/test/functions.test.js

const admin = require("firebase-admin");
const { getFunctions, connectFunctionsEmulator } = require("firebase/functions");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

// Configuration
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "lesotho-digital-trust";
const API_KEY = process.env.FIREBASE_API_KEY;

console.log("Cloud Functions Test Script");
console.log("============================");
console.log(`Project ID: ${PROJECT_ID}`);
console.log("");

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
  console.log("✓ Firebase Admin SDK initialized");
} catch (error) {
  console.error("✗ Failed to initialize Firebase Admin SDK:", error.message);
  process.exit(1);
}

const db = admin.firestore();

// Test functions
async function testListUserRoles() {
  console.log("\nTest: listUserRoles");
  console.log("-------------------");
  
  try {
    const functions = getFunctions();
    const listUserRoles = httpsCallable(functions, "listUserRoles");
    
    const result = await listUserRoles();
    console.log("✓ listUserRoles succeeded");
    console.log("  Users:", result.data.users?.length || 0);
    
    if (result.data.users) {
      result.data.users.forEach((user) => {
        console.log(`  - ${user.full_name || user.uid}: ${user.roles.join(", ")}`);
      });
    }
  } catch (error) {
    console.error("✗ listUserRoles failed:", error.message);
  }
}

async function testSetUserRole() {
  console.log("\nTest: setUserRole");
  console.log("----------------");
  
  const testUserId = "test_user_id";
  const testRole = "admin";
  const action = "grant";
  
  try {
    const functions = getFunctions();
    const setUserRole = httpsCallable(functions, "setUserRole");
    
    const result = await setUserRole({
      targetUid: testUserId,
      role: testRole,
      action: action,
    });
    
    console.log("✓ setUserRole succeeded");
    console.log("  Message:", result.data.message);
  } catch (error) {
    console.error("✗ setUserRole failed:", error.message);
    console.error("  Details:", error.details);
  }
}

async function testGetSecurityPolicy() {
  console.log("\nTest: getSecurityPolicy");
  console.log("----------------------");
  
  try {
    const functions = getFunctions();
    const getSecurityPolicy = httpsCallable(functions, "getSecurityPolicy");
    
    const result = await getSecurityPolicy();
    console.log("✓ getSecurityPolicy succeeded");
    console.log("  Actors:", result.data.actors?.join(", "));
    console.log("  Modules:", result.data.modules?.length || 0);
    console.log("  Permissions:", result.data.permissions?.length || 0);
  } catch (error) {
    console.error("✗ getSecurityPolicy failed:", error.message);
  }
}

async function testListAuditLog() {
  console.log("\nTest: listAuditLog");
  console.log("------------------");
  
  try {
    const functions = getFunctions();
    const listAuditLog = httpsCallable(functions, "listAuditLog");
    
    const result = await listAuditLog({ limit: 10 });
    console.log("✓ listAuditLog succeeded");
    console.log("  Entries:", result.data.entries?.length || 0);
    
    if (result.data.entries) {
      result.data.entries.forEach((entry) => {
        console.log(`  - ${entry.action} by ${entry.actor_uid.slice(0, 8)}...: ${entry.result}`);
      });
    }
  } catch (error) {
    console.error("✗ listAuditLog failed:", error.message);
  }
}

async function testAuditLogWrite() {
  console.log("\nTest: Audit Log Write Verification");
  console.log("----------------------------------");
  
  try {
    const snapshot = await db.collection("security_audit")
      .orderBy("timestamp", "desc")
      .limit(5)
      .get();
    
    console.log("✓ Retrieved recent audit entries");
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`  - ${data.action}: ${data.result} (${new Date(data.timestamp * 1000).toLocaleString()})`);
    });
  } catch (error) {
    console.error("✗ Failed to retrieve audit log:", error.message);
  }
}

async function testLedgerEventAppend() {
  console.log("\nTest: Ledger Event Append Verification");
  console.log("--------------------------------------");
  
  try {
    const snapshot = await db.collection("ledger_blocks")
      .orderBy("timestamp", "desc")
      .limit(3)
      .get();
    
    console.log("✓ Retrieved recent ledger blocks");
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`  - Block ${doc.id}: hash=${data.hash?.slice(0, 16)}...`);
    });
  } catch (error) {
    console.error("✗ Failed to retrieve ledger blocks:", error.message);
  }
}

async function testSecurityAdminOnlyAccess() {
  console.log("\nTest: Security Admin Only Access");
  console.log("--------------------------------");
  
  const testCollections = ["users", "mechanics", "service_requests", "reviews"];
  
  for (const collection of testCollections) {
    try {
      const snapshot = await db.collection(collection).limit(1).get();
      console.log(`✓ ${collection}: accessible (${snapshot.size} docs)`);
    } catch (error) {
      console.log(`✗ ${collection}: denied (${error.message})`);
    }
  }
}

async function testRestrictedCollections() {
  console.log("\nTest: Restricted Collections (should be denied)");
  console.log("-----------------------------------------------");
  
  const restrictedCollections = ["ledger_secrets", "ledger_state"];
  
  for (const collection of restrictedCollections) {
    try {
      const snapshot = await db.collection(collection).limit(1).get();
      console.log(`✗ ${collection}: UNEXPECTED ACCESS (${snapshot.size} docs)`);
    } catch (error) {
      console.log(`✓ ${collection}: correctly denied`);
    }
  }
}

// Main test runner
async function runTests() {
  console.log("Starting Cloud Functions tests...\n");
  
  await testListUserRoles();
  await testGetSecurityPolicy();
  await testListAuditLog();
  await testAuditLogWrite();
  await testLedgerEventAppend();
  await testSecurityAdminOnlyAccess();
  await testRestrictedCollections();
  
  console.log("\n============================");
  console.log("Tests completed");
  console.log("============================");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });
}

module.exports = {
  testListUserRoles,
  testSetUserRole,
  testGetSecurityPolicy,
  testListAuditLog,
  testAuditLogWrite,
  testLedgerEventAppend,
  testSecurityAdminOnlyAccess,
  testRestrictedCollections,
};
