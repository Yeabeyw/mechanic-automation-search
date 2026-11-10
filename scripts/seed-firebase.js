// Firebase Seed Data Script
// Run with: node scripts/seed-firebase.js
// This script seeds Firebase with test data for development and testing

const admin = require("firebase-admin");
const serviceAccount = require("../service-account-key.json"); // You need to provide your service account key

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "lesotho-digital-trust",
});

const db = admin.firestore();

// Seed data
const seedData = {
  // Users (6 users)
  users: [
    {
      uid: "user001",
      full_name: "Thabo Mokhesi",
      email: "thabo@example.com",
      roles: ["customer"],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      uid: "user002",
      full_name: "Mpho Moleleki",
      email: "mpho@example.com",
      roles: ["customer"],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      uid: "user003",
      full_name: "Kabelo Nkosi",
      email: "kabelo@example.com",
      roles: ["customer"],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      uid: "mech001",
      full_name: "Lerato Mokoena",
      email: "lerato@example.com",
      roles: ["mechanic"],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      uid: "admin001",
      full_name: "System Admin",
      email: "admin@autohelp.co.ls",
      roles: ["admin"],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      uid: "sec001",
      full_name: "Security Admin",
      email: "security@autohelp.co.ls",
      roles: ["security_admin"],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],

  // Mechanics (6 mechanics - 3 verified, 3 unverified)
  mechanics: [
    {
      code: "MECH-001",
      name: "Lerato Mokoena",
      workshop: "Mokoena Motor Works",
      town: "Maseru - Ha Abia",
      specialties: ["Engine", "Brakes", "Electrical"],
      experience_years: 12,
      verified: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      code: "MECH-002",
      name: "Sello Mphahlele",
      workshop: "Sello's Garage",
      town: "Maseru - Khubetsoana",
      specialties: ["Transmission", "Suspension"],
      experience_years: 8,
      verified: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      code: "MECH-003",
      name: "Mpho Moleleki",
      workshop: "Moleleki Auto",
      town: "Leribe",
      specialties: ["Engine", "Air Conditioning"],
      experience_years: 15,
      verified: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      code: "MECH-004",
      name: "Kabelo Nkosi",
      workshop: "Nkosi Motors",
      town: "Mafeteng",
      specialties: ["Brakes", "Tires"],
      experience_years: 5,
      verified: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      code: "MECH-005",
      name: "Tsepo Khathola",
      workshop: "Khathola Repairs",
      town: "Quthing",
      specialties: ["Electrical", "Engine"],
      experience_years: 7,
      verified: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      code: "MECH-006",
      name: "Matsoso Mphoko",
      workshop: "Mphoko Auto",
      town: "Butha-Buthe",
      specialties: ["Transmission", "Suspension", "Brakes"],
      experience_years: 10,
      verified: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],

  // Mechanic Owners (link mechanics to their user accounts)
  mechanic_owners: [
    {
      user_id: "mech001",
      mechanic_id: "MECH-001",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],

  // Service Requests (6 requests)
  service_requests: [
    {
      customer_uid: "user001",
      mechanic_id: "MECH-001",
      category: "Engine",
      vehicle_make: "Toyota",
      vehicle_model: "Hilux",
      vehicle_year: 2015,
      description: "Car won't start this morning in Ha Thetsane, clicking sound from engine",
      contact_phone: "+266 5800 0001",
      status: "sent",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      customer_uid: "user002",
      mechanic_id: "MECH-002",
      category: "Brakes",
      vehicle_make: "Nissan",
      vehicle_model: "Hardbody",
      vehicle_year: 2018,
      description: "Brakes making squeaking noise when stopping",
      contact_phone: "+266 5800 0002",
      status: "accepted",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      customer_uid: "user003",
      mechanic_id: "MECH-003",
      category: "Air Conditioning",
      vehicle_make: "Volkswagen",
      vehicle_model: "Golf 7",
      vehicle_year: 2020,
      description: "AC not cooling properly",
      contact_phone: "+266 5800 0003",
      status: "completed",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      customer_uid: "user001",
      mechanic_id: "MECH-002",
      category: "Transmission",
      vehicle_make: "Ford",
      vehicle_model: "Ranger",
      vehicle_year: 2019,
      description: "Transmission slipping when accelerating",
      contact_phone: "+266 5800 0001",
      status: "sent",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      customer_uid: "user002",
      mechanic_id: "MECH-003",
      category: "Engine",
      vehicle_make: "Toyota",
      vehicle_model: "Corolla",
      vehicle_year: 2017,
      description: "Engine overheating on long trips",
      contact_phone: "+266 5800 0002",
      status: "in_progress",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      customer_uid: "user003",
      mechanic_id: "MECH-001",
      category: "Electrical",
      vehicle_make: "Hyundai",
      vehicle_model: "i20",
      vehicle_year: 2021,
      description: "Battery draining overnight",
      contact_phone: "+266 5800 0003",
      status: "completed",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],

  // Reviews (6 reviews)
  reviews: [
    {
      mechanic_id: "MECH-003",
      customer_uid: "user003",
      rating: 5,
      comment: "Excellent service! Fixed my AC quickly and at a fair price.",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      mechanic_id: "MECH-001",
      customer_uid: "user003",
      rating: 4,
      comment: "Good work, but took a bit longer than expected.",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      mechanic_id: "MECH-002",
      customer_uid: "user002",
      rating: 5,
      comment: "Very professional and knowledgeable. Highly recommend!",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      mechanic_id: "MECH-003",
      customer_uid: "user002",
      rating: 4,
      comment: "Did a good job fixing the engine issue.",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      mechanic_id: "MECH-001",
      customer_uid: "user001",
      rating: 5,
      comment: "Great mechanic! Very honest and reliable.",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      mechanic_id: "MECH-002",
      customer_uid: "user001",
      rating: 3,
      comment: "Average service, but the price was reasonable.",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],

  // Ledger Secrets (salt for hashing)
  ledger_secrets: [
    {
      id: "salt",
      salt: "a".repeat(64),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],

  // Ledger State
  ledger_state: [
    {
      id: "head",
      block_index: 0,
      block_hash: "0".repeat(64),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],
};

// Seed function
async function seedDatabase() {
  console.log("Starting database seed...");

  try {
    // Seed users
    console.log("Seeding users...");
    for (const user of seedData.users) {
      await db.collection("users").doc(user.uid).set(user);
    }
    console.log(`✓ Seeded ${seedData.users.length} users`);

    // Seed mechanics
    console.log("Seeding mechanics...");
    for (const mechanic of seedData.mechanics) {
      await db.collection("mechanics").doc(mechanic.code).set(mechanic);
    }
    console.log(`✓ Seeded ${seedData.mechanics.length} mechanics`);

    // Seed mechanic owners
    console.log("Seeding mechanic owners...");
    for (const owner of seedData.mechanic_owners) {
      await db.collection("mechanic_owners").doc(owner.user_id).set(owner);
    }
    console.log(`✓ Seeded ${seedData.mechanic_owners.length} mechanic owners`);

    // Seed service requests
    console.log("Seeding service requests...");
    for (let i = 0; i < seedData.service_requests.length; i++) {
      const request = seedData.service_requests[i];
      await db.collection("service_requests").doc(`REQ-${String(i + 1).padStart(3, "0")}`).set(request);
    }
    console.log(`✓ Seeded ${seedData.service_requests.length} service requests`);

    // Seed reviews
    console.log("Seeding reviews...");
    for (let i = 0; i < seedData.reviews.length; i++) {
      const review = seedData.reviews[i];
      await db.collection("reviews").doc(`REV-${String(i + 1).padStart(3, "0")}`).set(review);
    }
    console.log(`✓ Seeded ${seedData.reviews.length} reviews`);

    // Seed ledger secrets
    console.log("Seeding ledger secrets...");
    for (const secret of seedData.ledger_secrets) {
      await db.collection("ledger_secrets").doc(secret.id).set(secret);
    }
    console.log(`✓ Seeded ${seedData.ledger_secrets.length} ledger secrets`);

    // Seed ledger state
    console.log("Seeding ledger state...");
    for (const state of seedData.ledger_state) {
      await db.collection("ledger_state").doc(state.id).set(state);
    }
    console.log(`✓ Seeded ${seedData.ledger_state.length} ledger state`);

    console.log("\n✅ Database seed completed successfully!");
    console.log("\nTest accounts:");
    console.log("- Customer: thabo@example.com (user001)");
    console.log("- Mechanic: lerato@example.com (mech001)");
    console.log("- Admin: admin@autohelp.co.ls (admin001)");
    console.log("- Security Admin: security@autohelp.co.ls (sec001)");
    console.log("\nNote: You'll need to set passwords in Firebase Authentication console.");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run seed
seedDatabase().then(() => {
  process.exit(0);
});
