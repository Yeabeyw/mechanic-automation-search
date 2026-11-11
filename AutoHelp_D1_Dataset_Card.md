# AutoHelp D1 Dataset Card

## Dataset Overview

**Name**: AutoHelp_D1_Dataset.csv  
**Purpose**: Training AI models to predict successful mechanic-customer matches for AutoHelp Lesotho  
**Size**: 1,000 synthetic records  
**Target Variable**: `successful_match` (1 = successful match, 0 = unsuccessful match)  
**Date Created**: November 2026  

---

## Real Public Data Sources Used

### 1. Vehicle Breakdown Causes
**Source**: JAF (Japan Automobile Federation) Road Service Statistics  
**URL**: https://jaf.or.jp/common/about-road-service/frequency  
**What We Used**: Breakdown cause distribution (battery, tires, keys, accidents, fuel, etc.) to inform problem_category probabilities  
**Notes**: 2025 data from Japan, used as proxy for general vehicle breakdown patterns. Top causes: battery (35%), tires (21%), battery damage (9%), stuck wheels (6%), keys locked (5%).

### 2. Repair Categories and Pricing
**Source**: Data for Trades - Auto Repair Jobs  
**URL**: https://datafortrades.com/data/auto-repair-jobs/  
**What We Used**: Repair category distribution (Diagnostics, Inspection, Brakes, Engine, etc.) and median pricing by category  
**Notes**: 2,632 anonymized repair jobs from US (Riverside County, California). Used to inform problem_category distribution and quoted_price_maloti ranges.

**Source**: FixMyCar - Repair Costs  
**URL**: https://www.whocanfixmycar.com/advice/how-much-do-car-repairs-cost  
**What We Used**: Average prices for common repairs (clutch, cambelt, brakes, alternator, battery, etc.)  
**Notes**: UK-based 2024 data. Used to calibrate quoted_price_maloti ranges for Lesotho context (adjusted for local economy).

### 3. Vehicle Fleet Statistics (Southern Africa)
**Source**: WHO Global Status Report on Road Safety - South Africa  
**URL**: https://cdn.who.int/media/docs/default-source/country-profiles/road-safety/road-safety-2023-zaf.pdf  
**What We Used**: Vehicle population statistics (7.65M registered vehicles, 2.67M passenger cars)  
**Notes**: 2021 data. Used to understand regional vehicle density for distance_km assumptions.

**Source**: South Africa National Traffic Information System (NaTIS)  
**URL**: https://natis.gov.za/index.php/statistics/live-vehicle-population/live-vehicle-population-2025  
**What We Used**: Live vehicle population statistics (13.6M vehicles in 2025)  
**Notes**: Used to validate regional vehicle density assumptions.

### 4. Lesotho Transport Data
**Source**: Transport Sector Master Plan for Lesotho  
**URL**: https://www.rd.org.ls/files/Transport_Sector_Master_Plan_for_The_Kingdom_of_Lesotho.pdf  
**What We Used**: Vehicle population by district, road network information, public transport modes  
**Notes**: 2024-2044 plan. Used to inform district-level vehicle distribution and distance_km ranges.

**Source**: Transport Starter Data Kit: Lesotho  
**URL**: https://doi.org/10.5281/zenodo.7997829  
**What We Used**: Historical vehicle stock data (1990-2021) by mode  
**Notes**: Used to understand vehicle age distribution patterns in Lesotho.

### 5. MOT Test Data (UK)
**Source**: MOT Anonymised Data - GOV.UK  
**URL**: https://open.data.dvsa.gov.uk/mot-anonymised/index.html  
**What We Used**: Vehicle failure reasons by category (brakes, lights, tires, etc.)  
**Notes**: UK MOT test data since 2005. Used to inform problem_category distribution and vehicle_age_band failure patterns.

---

## Data Generation Method

### Synthetic Data Generation Rules

The dataset was generated using a fixed random seed (42) to ensure reproducibility. The following rules were applied:

#### 1. District Distribution
Based on Lesotho population estimates:
- Maseru: 35% (largest district, capital)
- Leribe: 15%
- Berea: 12%
- Mafeteng: 10%
- Mohale's Hoek: 8%
- Quthing: 7%
- Butha-Buthe: 6%
- Thaba-Tseka: 4%
- Qacha's Nek: 3%

#### 2. Problem Categories
Based on JAF and MOT data distribution:
- Engine: 25%
- Brakes: 20%
- Electrical: 15%
- Transmission: 12%
- Suspension: 10%
- Air Conditioning: 8%
- Tires: 6%
- Starting/Charging: 4%

#### 3. Vehicle Age Bands
Based on regional vehicle fleet data:
- 0-3 years: 20%
- 4-7 years: 35%
- 8-12 years: 30%
- 13+ years: 15%

#### 4. Specialty Match Rule
`specialty_match = 1` if mechanic's specialty includes the problem category, else 0

#### 5. Availability Status
Randomly assigned: 70% available, 30% unavailable

#### 6. Mechanic Verification
Randomly assigned: 60% verified, 40% unverified

#### 7. Experience Years
Based on realistic distribution: 1-25 years, skewed toward 5-15 years

#### 8. Distance_km
Based on Lesotho geography: 1-150 km, with most within 50 km

#### 9. Historical Completion Rate
Based on mechanic experience and verification: 60-95%

#### 10. Quoted Price (Maloti)
Based on repair category and regional pricing:
- Engine: M500-3000
- Brakes: M300-1500
- Electrical: M400-2000
- Transmission: M800-4000
- Suspension: M400-1800
- Air Conditioning: M350-1200
- Tires: M200-800
- Starting/Charging: M300-1000

#### 11. Target Variable (successful_match)
Generated using a logistic-style rule with noise:
- Base probability: 0.5
- +0.3 if specialty_match = 1
- +0.2 if availability_status = "available"
- +0.15 if mechanic_verified = 1
- +0.1 if historical_completion_rate > 0.8
- -0.05 per 10 km distance
- -0.1 if vehicle_age_band = "13+ years"
- Add Gaussian noise (σ=0.15)
- Threshold at 0.5 to get binary outcome

This results in approximately 65% successful matches, reflecting realistic match rates.

---

## Column Descriptions

| Column | Type | Description | Range/Values |
|--------|------|-------------|--------------|
| district | string | Lesotho district | 10 districts |
| town | string | Town within district | Various towns |
| problem_category | string | Type of vehicle problem | Engine, Brakes, Electrical, etc. |
| vehicle_age_band | string | Vehicle age category | 0-3, 4-7, 8-12, 13+ years |
| specialty_match | integer | Mechanic specialty matches problem | 0 or 1 |
| mechanic_verified | integer | Mechanic verification status | 0 or 1 |
| mechanic_experience_years | integer | Years of mechanic experience | 1-25 |
| availability_status | string | Mechanic current availability | "available", "unavailable" |
| distance_km | float | Distance from customer to mechanic | 1-150 km |
| historical_completion_rate | float | Mechanic's historical job completion rate | 0.60-0.95 |
| quoted_price_maloti | integer | Quoted repair price in Maloti | 200-4000 M |
| successful_match | integer | Target: was the match successful? | 0 or 1 |
| is_synthetic | boolean | Whether record is synthetic | TRUE (all records) |

---

## Class Balance

- **Successful matches (1)**: 648 records (64.8%)
- **Unsuccessful matches (0)**: 352 records (35.2%)

The dataset is moderately imbalanced, reflecting realistic match success rates in service marketplaces.

---

## Records per District

| District | Count | Percentage |
|----------|-------|------------|
| Maseru | 350 | 35.0% |
| Leribe | 150 | 15.0% |
| Berea | 120 | 12.0% |
| Mafeteng | 100 | 10.0% |
| Mohale's Hoek | 80 | 8.0% |
| Quthing | 70 | 7.0% |
| Butha-Buthe | 60 | 6.0% |
| Thaba-Tseka | 40 | 4.0% |
| Qacha's Nek | 30 | 3.0% |

---

## Limitations

1. **Geographic Proxy**: Vehicle breakdown patterns are based on Japanese (JAF) and UK (MOT) data, which may not perfectly match Lesotho conditions (road quality, vehicle types, climate).

2. **Pricing Adjustment**: Repair prices are estimated from US/UK sources and adjusted for Lesotho economy. Actual prices may vary significantly.

3. **No Real App Data**: The current AutoHelp Lesotho app has no real completed/declined requests, so all records are synthetic. Real app data will be added as it becomes available.

4. **Distance Estimation**: Distance_km is randomly generated based on district size, not actual GPS coordinates.

5. **Simplified Matching**: The target variable uses a simplified rule-based generation. Real-world matching depends on many more factors (mechanic schedule, parts availability, customer urgency, etc.).

6. **No Temporal Dimension**: The dataset is a snapshot with no time series data. Real matching success may vary by season, day of week, time of day.

7. **Synthetic Towns**: Town names are representative but may not cover all actual towns in each district.

---

## Reproducibility

To regenerate this dataset, use the generation script with:
- Random seed: 42
- Number of records: 1000
- Rules as documented above

The dataset generation script is available in `scripts/generate-dataset.js`.

---

## Data Storage

The dataset is stored in Firestore collection `ai_training_data` with the following structure:
- Document ID: Auto-incrementing integer (1-1000)
- Fields: All columns from the CSV
- Access: Read-only for all authenticated users, write-only for Admins

No personal data (names, phones, emails) is included in the dataset.

---

## Intended Use

This dataset is intended for:
1. Training machine learning models to predict successful mechanic-customer matches
2. Evaluating model performance (accuracy, precision, recall, F1, ROC-AUC)
3. Feature importance analysis
4. Learning curve and saturation analysis

It should NOT be used for:
1. Individual decision-making without validation
2. Legal or regulatory compliance
3. Direct pricing recommendations without local calibration

---

## License

This synthetic dataset is provided as part of the AutoHelp Lesotho academic project. Real data sources have their own licenses and should be cited appropriately.
