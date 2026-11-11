# AutoHelp D1 Dataset Card

**File**: AutoHelp_D1_Dataset.csv  
**Records**: 1000 (1000 synthetic, 0 real)  
**Target**: `successful_match` (1 = the customer-mechanic match succeeded)  
**Class balance**: 480 successful (48.0%) and 520 unsuccessful (52.0%)  
**Generated**: 2026-11-11 with fixed seed 42 (`npm run ai:train` recreates it exactly)

## Objective

The application helps drivers in Lesotho find a suitable mechanic. The AI objective is **content discovery**: rank verified mechanics by the predicted probability that a match with a given customer request will succeed, so the best-fit mechanic is shown first.

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

**Important**: these sources only informed the shape of the data (typical breakdown categories, price levels and the Lesotho district mix). No public dataset contains Lesotho mechanic-customer outcomes, so every row in this file is synthetic and is flagged `is_synthetic = TRUE`.

## Schema

| Column | Type | Meaning |
|---|---|---|
| `id` | string | Unique record id (SYN-0001 …) |
| `district` | category | Lesotho district of the request (10 districts) |
| `town` | category | Town within the district |
| `problem_category` | category | Engine, Battery, Tyre, Brakes, Electrical, Other |
| `vehicle_age_band` | category | 0-3, 4-7, 8-12 or 13+ years |
| `specialty_match` | 0/1 | Mechanic specialties include the problem category |
| `mechanic_verified` | 0/1 | Mechanic is verified on the platform |
| `mechanic_experience_years` | integer | Years of mechanic experience |
| `availability_status` | category | available / unavailable |
| `distance_km` | number | Distance from customer to mechanic (km, synthetic) |
| `historical_completion_rate` | number | Share of past jobs the mechanic completed |
| `quoted_price_maloti` | integer | Quoted repair price in Maloti (M) |
| `successful_match` | 0/1 | TARGET: the match succeeded |
| `is_synthetic` | TRUE/FALSE | TRUE for generated rows |
| `created_at` | date | Request date |

## Observed distributions

### District
| district | Records | Share |
|---|---|---|
| Maseru | 312 | 31.2% |
| Leribe | 140 | 14.0% |
| Berea | 112 | 11.2% |
| Mafeteng | 112 | 11.2% |
| Mohale's Hoek | 77 | 7.7% |
| Quthing | 64 | 6.4% |
| Butha-Buthe | 63 | 6.3% |
| Thaba-Tseka | 44 | 4.4% |
| Mokhotlong | 39 | 3.9% |
| Qacha's Nek | 37 | 3.7% |

### Problem category
| problem_category | Records | Share |
|---|---|---|
| Battery | 217 | 21.7% |
| Tyre | 173 | 17.3% |
| Brakes | 168 | 16.8% |
| Engine | 164 | 16.4% |
| Electrical | 151 | 15.1% |
| Other | 127 | 12.7% |

### Vehicle age band
| vehicle_age_band | Records | Share |
|---|---|---|
| 8-12 years | 329 | 32.9% |
| 4-7 years | 323 | 32.3% |
| 0-3 years | 182 | 18.2% |
| 13+ years | 166 | 16.6% |

### Availability
| availability_status | Records | Share |
|---|---|---|
| available | 715 | 71.5% |
| unavailable | 285 | 28.5% |

### Numeric ranges
| Column | Observed range |
|---|---|
| `mechanic_experience_years` | 4 to 24 (mean 8.82) |
| `distance_km` | 2 to 128 (mean 53.51) |
| `historical_completion_rate` | 0.62 to 0.97 (mean 0.79) |
| `quoted_price_maloti` | 200 to 2798 (mean 887.41) |

## How the data was generated

Rows are produced by `src/lib/ai/dataset.ts` (`generateSyntheticRecords`, seed 42):

- District drawn with population-style weights (Maseru largest); town drawn from that district.
- Problem category and vehicle age band drawn from weighted lists.
- `specialty_match` = 1 for 58%, `mechanic_verified` = 1 for 62%, `availability_status` = available for 70%.
- Distance: 2 to 40 km in Maseru, 8 to 128 km elsewhere. Price: uniform within a per-category range in Maloti.
- Completion rate rises with verification and experience, then is clamped to 0.55 to 0.97.

**Target rule.** A success probability is computed as:

`p = 0.22 + 0.32·specialty_match + 0.22 (available) or −0.18 (unavailable) + 0.14·verified + 0.35·max(0, completion − 0.70) + min(0.08, experience/250) − distance/280 − 0.08 (vehicle 13+ years) − max(0, price − 1800)/9000 + noise`

The noise is Gaussian with σ = 0.12, `p` is clamped to 0.03 to 0.97, and `successful_match = 1` when `p ≥ 0.5`.

## Quality checks

- Missing values: 0
- Duplicate ids: 0
- Target values: only 0 and 1 (verified)
- All 10 Lesotho districts present: yes

## Limitations and responsible use

- The labels come from a known formula, so models can only learn that formula. Scores measure how well a model recovers the rule, not how it would perform on real customers.
- Distances are simulated, not GPS routes. Prices are indicative.
- The dataset contains no personal data (no names, phone numbers or real vehicle registrations).
- When real app outcomes arrive they should be appended with `is_synthetic = FALSE`, the models retrained, and results compared against this baseline.
