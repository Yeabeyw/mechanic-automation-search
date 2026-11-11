// AutoHelp D1 Dataset Generator
// Generates 1000 synthetic records for AI training
// Run with: node scripts/generate-dataset.js

const fs = require('fs');
const path = require('path');

// Fixed random seed for reproducibility
let seed = 42;

function seededRandom() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function seededRandomInt(min, max) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function seededRandomFloat(min, max) {
  return seededRandom() * (max - min) + min;
}

function seededRandomChoice(array) {
  return array[Math.floor(seededRandom() * array.length)];
}

function seededRandomWeighted(array, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = seededRandom() * totalWeight;
  for (let i = 0; i < array.length; i++) {
    random -= weights[i];
    if (random <= 0) return array[i];
  }
  return array[array.length - 1];
}

function resetSeed() {
  seed = 42;
}

// Data definitions
const districts = [
  { name: 'Maseru', weight: 35, towns: ['Maseru', 'Ha Abia', 'Khubetsoana', 'Maseru West', 'Maseru East'] },
  { name: 'Leribe', weight: 15, towns: ['Leribe', 'Maputsoe', 'Hlotse', 'Teyateyaneng'] },
  { name: 'Berea', weight: 12, towns: ['Teyateyaneng', 'Manka', 'Mpharane', 'Likalaneng'] },
  { name: 'Mafeteng', weight: 10, towns: ['Mafeteng', 'Mohales Hoek', 'Metsi Maholo', 'Qalabane'] },
  { name: "Mohale's Hoek", weight: 8, towns: ["Mohale's Hoek", 'Mpharane', 'Mokhotlong', 'Qobong'] },
  { name: 'Quthing', weight: 7, towns: ['Quthing', 'Mphaki', 'Mokotjomela', 'Mosenekeng'] },
  { name: 'Butha-Buthe', weight: 6, towns: ['Butha-Buthe', 'Likila', 'Mokhotlong', 'Peka'] },
  { name: 'Thaba-Tseka', weight: 4, towns: ['Thaba-Tseka', 'Metsi Maholo', 'Rakotso', 'Sehong-hong'] },
  { name: "Qacha's Nek", weight: 3, towns: ["Qacha's Nek", 'Mokotjomela', 'Ramotswa', 'Tsoelike'] },
];

const problemCategories = [
  { name: 'Engine', weight: 25, priceRange: [500, 3000] },
  { name: 'Brakes', weight: 20, priceRange: [300, 1500] },
  { name: 'Electrical', weight: 15, priceRange: [400, 2000] },
  { name: 'Transmission', weight: 12, priceRange: [800, 4000] },
  { name: 'Suspension', weight: 10, priceRange: [400, 1800] },
  { name: 'Air Conditioning', weight: 8, priceRange: [350, 1200] },
  { name: 'Tires', weight: 6, priceRange: [200, 800] },
  { name: 'Starting/Charging', weight: 4, priceRange: [300, 1000] },
];

const vehicleAgeBands = [
  { name: '0-3 years', weight: 20 },
  { name: '4-7 years', weight: 35 },
  { name: '8-12 years', weight: 30 },
  { name: '13+ years', weight: 15 },
];

const specialties = ['Engine', 'Brakes', 'Electrical', 'Transmission', 'Suspension', 'Air Conditioning', 'Tires', 'Starting/Charging'];

const availabilityStatuses = ['available', 'unavailable'];

// Generate a single record
function generateRecord(id) {
  // Select district
  const district = seededRandomWeighted(
    districts.map(d => d.name),
    districts.map(d => d.weight)
  );
  const districtData = districts.find(d => d.name === district);
  const town = seededRandomChoice(districtData.towns);

  // Select problem category
  const problemCategory = seededRandomWeighted(
    problemCategories.map(c => c.name),
    problemCategories.map(c => c.weight)
  );
  const categoryData = problemCategories.find(c => c.name === problemCategory);

  // Select vehicle age band
  const vehicleAgeBand = seededRandomWeighted(
    vehicleAgeBands.map(a => a.name),
    vehicleAgeBands.map(a => a.weight)
  );

  // Generate mechanic attributes
  const mechanicSpecialties = [];
  const numSpecialties = seededRandomInt(1, 3);
  for (let i = 0; i < numSpecialties; i++) {
    const specialty = seededRandomChoice(specialties);
    if (!mechanicSpecialties.includes(specialty)) {
      mechanicSpecialties.push(specialty);
    }
  }

  const specialtyMatch = mechanicSpecialties.includes(problemCategory) ? 1 : 0;
  const mechanicVerified = seededRandom() < 0.6 ? 1 : 0;
  const mechanicExperienceYears = seededRandomInt(1, 25);
  const availabilityStatus = seededRandomChoice(availabilityStatuses);
  const historicalCompletionRate = seededRandomFloat(0.60, 0.95);

  // Distance based on district (Maseru has shorter average distances)
  let baseDistance;
  if (district === 'Maseru') {
    baseDistance = seededRandomFloat(1, 50);
  } else {
    baseDistance = seededRandomFloat(10, 150);
  }
  const distanceKm = Math.round(baseDistance * 10) / 10;

  // Quoted price based on category with some variation
  const [minPrice, maxPrice] = categoryData.priceRange;
  const quotedPriceMaloti = seededRandomInt(minPrice, maxPrice);

  // Calculate successful_match probability
  let probability = 0.5;
  probability += specialtyMatch * 0.3;
  probability += (availabilityStatus === 'available' ? 1 : 0) * 0.2;
  probability += mechanicVerified * 0.15;
  probability += (historicalCompletionRate > 0.8 ? 1 : 0) * 0.1;
  probability -= (distanceKm / 10) * 0.05;
  probability -= (vehicleAgeBand === '13+ years' ? 1 : 0) * 0.1;

  // Add Gaussian noise
  const noise = (seededRandom() - 0.5) * 0.3;
  probability += noise;

  // Threshold to get binary outcome
  const successfulMatch = probability > 0.5 ? 1 : 0;

  return {
    id,
    district,
    town,
    problem_category: problemCategory,
    vehicle_age_band: vehicleAgeBand,
    specialty_match: specialtyMatch,
    mechanic_verified: mechanicVerified,
    mechanic_experience_years: mechanicExperienceYears,
    availability_status: availabilityStatus,
    distance_km: distanceKm,
    historical_completion_rate: Math.round(historicalCompletionRate * 100) / 100,
    quoted_price_maloti: quotedPriceMaloti,
    successful_match: successfulMatch,
    is_synthetic: 'TRUE',
  };
}

// Generate 1000 records
const records = [];
for (let i = 1; i <= 1000; i++) {
  records.push(generateRecord(i));
}

// Convert to CSV
function toCSV(records) {
  const headers = Object.keys(records[0]);
  const csvRows = [headers.join(',')];

  for (const record of records) {
    const values = headers.map(header => {
      const value = record[header];
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

// Save CSV
const csv = toCSV(records);
const csvPath = path.join(__dirname, '..', 'AutoHelp_D1_Dataset.csv');
fs.writeFileSync(csvPath, csv);
console.log(`✓ Generated ${records.length} records`);
console.log(`✓ Saved to ${csvPath}`);

// Calculate statistics
const successfulMatches = records.filter(r => r.successful_match === 1).length;
const unsuccessfulMatches = records.filter(r => r.successful_match === 0).length;

console.log('\nClass Balance:');
console.log(`- Successful matches (1): ${successfulMatches} (${((successfulMatches / records.length) * 100).toFixed(1)}%)`);
console.log(`- Unsuccessful matches (0): ${unsuccessfulMatches} (${((unsuccessfulMatches / records.length) * 100).toFixed(1)}%)`);

console.log('\nRecords per District:');
const districtCounts = {};
records.forEach(r => {
  districtCounts[r.district] = (districtCounts[r.district] || 0) + 1;
});
Object.entries(districtCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([district, count]) => {
    console.log(`- ${district}: ${count} (${((count / records.length) * 100).toFixed(1)}%)`);
  });

console.log('\nRecords per Problem Category:');
const categoryCounts = {};
records.forEach(r => {
  categoryCounts[r.problem_category] = (categoryCounts[r.problem_category] || 0) + 1;
});
Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    console.log(`- ${category}: ${count} (${((count / records.length) * 100).toFixed(1)}%)`);
  });
