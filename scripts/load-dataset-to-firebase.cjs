// Load AutoHelp D1 Dataset to Firestore
// Run with: node scripts/load-dataset-to-firebase.cjs
// Requires: service-account-key.json in project root

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'lesotho-digital-trust',
});

const db = admin.firestore();

// Read CSV file
const csvPath = path.join(__dirname, '..', 'AutoHelp_D1_Dataset.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record = {};
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      // Convert numeric fields
      if (['id', 'specialty_match', 'mechanic_verified', 'mechanic_experience_years', 'quoted_price_maloti', 'successful_match'].includes(header)) {
        record[header] = parseInt(value, 10);
      } else if (['distance_km', 'historical_completion_rate'].includes(header)) {
        record[header] = parseFloat(value);
      } else {
        record[header] = value;
      }
    });
    records.push(record);
  }

  return records;
}

async function loadDataset() {
  console.log('Loading dataset to Firestore...');

  try {
    const records = parseCSV(csvContent);
    console.log(`Parsed ${records.length} records from CSV`);

    // Clear existing data
    console.log('Clearing existing ai_training_data collection...');
    const existingSnapshot = await db.collection('ai_training_data').get();
    const batch = db.batch();
    existingSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Cleared ${existingSnapshot.size} existing records`);

    // Load new data in batches
    const batchSize = 500;
    let loaded = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = db.batch();
      const chunk = records.slice(i, i + batchSize);

      chunk.forEach(record => {
        const docRef = db.collection('ai_training_data').doc(String(record.id));
        batch.set(docRef, record);
      });

      await batch.commit();
      loaded += chunk.length;
      console.log(`Loaded ${loaded}/${records.length} records`);
    }

    console.log(`✅ Successfully loaded ${records.length} records to Firestore`);
  } catch (error) {
    console.error('❌ Error loading dataset:', error);
    process.exit(1);
  }
}

loadDataset().then(() => {
  process.exit(0);
});
