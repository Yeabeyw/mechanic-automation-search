# AutoHelp D4: Accuracy and Saturation Report

**Generated**: 2026-11-11 from `src/lib/ai/trained-artifact.json` (trained 2026-11-11, seed 42)  
**Dataset**: AutoHelp_D1_Dataset.csv, 1000 synthetic records, 48.0% positive  
**Models**: Baseline rule, Logistic Regression, Random Forest (all implemented in TypeScript in `src/lib/ai`)  
**Split**: 800 train / 200 test (stratified 80/20), 5-fold cross-validation on the training part

## 1. Summary

- The best model is **Logistic Regression**: accuracy 85.5%, F1 84.7%, ROC-AUC 0.929 on the held-out test set.
- Both learned models beat the rule-based baseline (accuracy 80.5%, F1 78.2%). The majority-class rate is 52.0%, so every model is well above guessing.
- **Saturation**: Logistic Regression: not saturated by 800 records. Random Forest: not saturated by 800 records. The baseline does not learn, so saturation does not apply.
- The test set has only 200 rows, so one accuracy figure carries roughly ±4.9 points of sampling error (95% interval). Differences of a few points between models on a single split should not be over-read.
- The data is synthetic, so scores show how well each model recovers the generator rule, not real-world performance.

## 2. Test-set results

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | 5-fold CV F1 (mean ± sd) |
|---|---|---|---|---|---|---|
| Baseline (rule) | 80.5% | 84.3% | 72.9% | 78.2% | 0.802 | 78.8% ± 3.5% |
| Logistic Regression ★ | 85.5% | 86.0% | 83.3% | 84.7% | 0.929 | 86.8% ± 2.8% |
| Random Forest | 82.5% | 84.3% | 78.1% | 81.1% | 0.910 | 82.6% ± 5.1% |

Confusion matrices (test set):

| Model | True pos | False pos | True neg | False neg |
|---|---|---|---|---|
| Baseline (rule) | 70 | 13 | 91 | 26 |
| Logistic Regression | 80 | 13 | 91 | 16 |
| Random Forest | 75 | 14 | 90 | 21 |

Logistic Regression had a higher cross-validated F1 than Random Forest in 4 of 5 folds (86.8% against 82.6% on average), which supports choosing it. The labels were built from an additive formula, which suits a linear model well. A forest needs more data to approximate the same thresholds.

## 3. Learning curves and saturation

Method: for each training size (50, 100, 200, 300, 500, 700, 800) the model was trained on a random sample, scored on its own training rows and on a held-out 20%, and repeated 5 times with different seeds. **Saturation** is the smallest size after which validation F1 never improves by 1 percentage point or more.

### Logistic Regression
| Training size | Train F1 | Validation F1 | Val F1 std | Gap (train − val) |
|---|---|---|---|---|
| 50 | 0.986 | 0.655 | 0.195 | 0.331 |
| 100 | 0.928 | 0.781 | 0.059 | 0.148 |
| 200 | 0.898 | 0.827 | 0.020 | 0.071 |
| 300 | 0.891 | 0.839 | 0.026 | 0.052 |
| 500 | 0.887 | 0.847 | 0.058 | 0.040 |
| 700 | 0.895 | 0.856 | 0.020 | 0.039 |
| 800 | 0.872 | 0.869 | 0.038 | 0.003 |

Not saturated: validation F1 was still improving at the largest size tested (800 records, F1 86.9%). From 50 to 800 records validation F1 rose by 21.4 points, and from 300 to 800 by 3.0 points.

### Random Forest
| Training size | Train F1 | Validation F1 | Val F1 std | Gap (train − val) |
|---|---|---|---|---|
| 50 | 0.837 | 0.587 | 0.363 | 0.250 |
| 100 | 0.914 | 0.686 | 0.183 | 0.227 |
| 200 | 0.910 | 0.778 | 0.051 | 0.132 |
| 300 | 0.913 | 0.787 | 0.080 | 0.126 |
| 500 | 0.896 | 0.802 | 0.043 | 0.094 |
| 700 | 0.890 | 0.825 | 0.030 | 0.064 |
| 800 | 0.876 | 0.836 | 0.020 | 0.040 |

Not saturated: validation F1 was still improving at the largest size tested (800 records, F1 83.6%). From 300 to 800 records validation F1 rose by 4.9 points.

### Baseline
| Training size | Train F1 | Validation F1 | Val F1 std | Gap (train − val) |
|---|---|---|---|---|
| 50 | 0.787 | 0.753 | 0.139 | 0.034 |
| 100 | 0.773 | 0.851 | 0.090 | -0.078 |
| 200 | 0.796 | 0.790 | 0.052 | 0.006 |
| 300 | 0.783 | 0.774 | 0.039 | 0.009 |
| 500 | 0.793 | 0.786 | 0.053 | 0.008 |
| 700 | 0.797 | 0.797 | 0.034 | 0.000 |
| 800 | 0.786 | 0.790 | 0.020 | -0.004 |

Not applicable. The baseline is a fixed rule (specialty match and available), so it learns nothing from more data. Its curve only shows sampling noise.

## 4. Overfitting and underfitting

- **Overfitting** is a high training score with a much lower validation score. **Underfitting** is both scores staying low.
- Logistic Regression at 50 records: train F1 0.986 against validation 0.655 (gap 0.331), clear overfitting on tiny samples. At 800 records the gap is 0.003, so it generalises well.
- Random Forest at 50 records: gap 0.250. At 800 records the gap is still 0.040: trees fit the training rows more closely than new rows, a mild overfit.
- The baseline sits near 0.790 F1 at every size. It is a rigid rule that ignores distance, verification and history, which is mild **underfitting** (high bias).

## 5. Random Forest: number of trees

| Trees | Train F1 | Validation F1 | Validation accuracy |
|---|---|---|---|
| 1 | 0.734 | 0.647 | 63.5% |
| 5 | 0.859 | 0.698 | 71.0% |
| 10 | 0.894 | 0.794 | 80.5% |
| 20 | 0.897 | 0.811 | 82.0% |
| 40 | 0.911 | 0.824 | 83.5% |
| 80 | 0.900 | 0.800 | 81.5% |
| 120 | 0.906 | 0.804 | 82.0% |
| 160 | 0.898 | 0.793 | 81.0% |
| 200 | 0.906 | 0.802 | 81.5% |

Validation F1 peaks at 40 trees (0.824). From 40 to 200 trees it only moves within 0.793 to 0.824, which is noise on a 200-row test set, not a trend. Adding trees raises cost without raising accuracy, so the model uses 40 trees. Training F1 stays near 0.90 against about 0.80 on validation, which confirms the overfit described above.

## 6. Logistic Regression convergence

| Iteration | Training loss |
|---|---|
| 1 | 0.6932 |
| 25 | 0.4470 |
| 50 | 0.3816 |
| 100 | 0.3402 |
| 200 | 0.3215 |
| 300 | 0.3175 |
| 400 | 0.3165 |

Loss starts at 0.693 (a coin flip) and falls to 0.316. It gains less than 0.001 over any further 50 iterations from about iteration 272, so the 400 iterations used are enough. Only training loss is recorded, so convergence is judged on training loss plus the validation curves above.

## 7. Why accuracy alone can mislead

Accuracy hides which kind of mistake is made. A model that always predicts the majority class scores 52.0% here without learning anything, and on a 90/10 dataset it would score 90% while never finding a good match. This dataset is nearly balanced (48.0% positive), so accuracy is a fair headline, but the report still gives precision (how many recommended matches succeed), recall (how many good matches are found), F1 and ROC-AUC. For Logistic Regression: precision 86.0%, recall 83.3%. A false positive sends a driver to a mechanic who then fails them, so precision matters most for this app.

## 8. What saturation means and how to go past it

Saturation means more data of the same kind no longer improves the model. Typical causes are limited model capacity, noise in the labels, or features that do not carry more signal. Here neither learned model has saturated by 800 records, so collecting more records is the cheapest next step. Beyond that:

1. Replace synthetic rows with real app outcomes (`is_synthetic = FALSE`) and retrain.
2. Add features: real driving distance, parts availability, mechanic schedule, urgency, customer reviews.
3. Tune hyperparameters (tree depth, regularisation) with cross-validation and try gradient boosting.
4. Re-run the learning curves after each data increase to see whether the curve has flattened.

## 9. Reproducing and cross-checking

- `npm run ai:train` regenerates the dataset, models, metrics and curves. `npm run docs:part-d` rebuilds this report and the dataset card. `npm run verify:part-d` checks every Part D requirement.
- `AutoHelp_D2_Model_Training.ipynb` retrains the same task with scikit-learn as an independent check. Its scores differ a little because the implementations and settings differ (for example 100 trees there against 40 here). The dashboards and this report use the TypeScript pipeline.
