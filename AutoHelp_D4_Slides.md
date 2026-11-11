# AutoHelp D4: Accuracy and Saturation - Slide Deck

This document outlines the content for a 5-slide PowerPoint presentation on accuracy and saturation analysis.

---

## Slide 1: Title Slide

**Title**: AutoHelp Lesotho - Accuracy and Saturation Analysis  
**Subtitle**: Machine Learning Model Performance Evaluation  
**Date**: November 2026  
**Presenter**: [Your Name]

**Key Points**:
- Dataset: 1000 synthetic records
- Models: Baseline, Logistic Regression, Random Forest
- Focus: Learning curves, saturation points, model convergence

---

## Slide 2: Learning Curves & Saturation

**Title**: Learning Curves: How Performance Scales with Data

**Content**:

**Training Sizes Tested**: 50, 100, 200, 300, 500, 700, 800 records (5 repeats each)

**Random Forest Results**:
- 50 records: 62% accuracy, 59% F1
- 500 records: 79% accuracy, 76% F1
- 800 records: 79% accuracy, 76% F1

**Saturation Point**: 500 records
- F1 improvement from 500→700: 0.6% (below 1% threshold)
- Additional data provides diminishing returns

**Logistic Regression Results**:
- 50 records: 60% accuracy, 57% F1
- 500 records: 75% accuracy, 73% F1
- 800 records: 77% accuracy, 74% F1

**Key Insight**: Both models saturate at ~500 records for this synthetic dataset

**Visual**: Line chart showing training size vs F1 score for both models

---

## Slide 3: Model-Specific Analysis

**Title**: Random Forest Trees & Logistic Regression Convergence

**Content**:

**Random Forest: Number of Trees vs Performance**
- 1 tree: 70% accuracy, 65% F1
- 50 trees: 78% accuracy, 75% F1
- 100 trees: 79% accuracy, 76% F1
- 200 trees: 79% accuracy, 76% F1 (no improvement)

**Optimal**: 100 trees (performance plateaus, training time increases)

**Logistic Regression: Training Loss per Iteration**
- Iteration 0: Loss 0.693
- Iteration 300: Loss 0.456
- Iteration 600: Loss 0.406 (validation plateaus)
- Iteration 1000: Loss 0.379 (training continues, validation stable)

**Convergence**: ~600 iterations
- Slight overfitting after 600 iterations
- Validation loss stops improving

**Visual**: Two charts - (1) Trees vs F1, (2) Iterations vs Loss

---

## Slide 4: Accuracy, Overfitting, and Saturation

**Title**: Understanding Model Behavior

**Content**:

**Why Accuracy Can Mislead**:
- With 90/10 class imbalance, always predicting majority = 90% accuracy
- Our dataset is balanced (49.3% vs 50.7%), so accuracy is reliable
- F1, Precision, Recall, ROC-AUC provide fuller picture

**Overfitting vs Underfitting**:
- **Underfitting**: Low training & validation scores (Baseline model)
- **Good Fit**: High training, validation close to training (RF at 500+ records)
- **Overfitting**: High training, low validation (LR after 600 iterations)

**What Saturation Means**:
- Model has learned all patterns in current data distribution
- Adding more data of same type provides diminishing returns
- Indicates need for: more diverse data, better features, or model improvements

**Visual**: Diagram showing underfitting, good fit, overfitting curves

---

## Slide 5: Pushing Past Saturation

**Title**: How to Improve Beyond Current Performance

**Content**:

**Current Performance**:
- Random Forest: 79% accuracy, 76% F1
- Logistic Regression: 77% accuracy, 74% F1
- Saturation at 500 records

**To Improve - Add These Data Types**:
1. **Real-world outcomes**: Actual app request results
2. **GPS distance**: Actual driving distance
3. **Parts availability**: Stock status
4. **Mechanic schedule**: Real-time availability
5. **Customer urgency**: Time sensitivity
6. **Seasonal patterns**: Demand variations

**To Improve - Add These Features**:
- Vehicle make/model specialization
- Customer history
- Mechanic ratings
- Response time
- Price competitiveness

**Recommendations**:
1. Use Random Forest (100 trees) as production model
2. Collect real app data to replace synthetic
3. Retrain when 100+ new records available
4. Add GPS distance and schedule integration

**Next Steps**: Implement data collection pipeline, monitor performance, retrain quarterly

---

## Notes for Presenter

- Emphasize that current results are on synthetic data
- Real data may show different patterns and saturation points
- Saturation is not a failure - it indicates model has learned current patterns
- The goal is to collect diverse real data to push saturation higher
- PowerPoint can be created from this outline using template
- Include actual charts from the learning curve analysis
