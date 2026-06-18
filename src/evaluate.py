"""
Evaluation metrics for explanation quality and defence rule effectiveness.

Metrics follow the xNIDS paper (Sec 6):
  - Fidelity   : Descriptive Accuracy (DA) — how faithfully the explanation
                 identifies the features that drove the detection
  - Sparsity   : Mass Around Zero (MAZ) — how few features are selected
  - Stability  : Intersection size of top-K features across N runs
  - Confidence calibration (our addition): correlation of confidence score
                 with actual explanation stability
"""
import numpy as np
from sklearn.metrics import accuracy_score


# ---------------------------------------------------------------------------
# Fidelity — Descriptive Accuracy (DA)
# ---------------------------------------------------------------------------

def descriptive_accuracy(predict_fn, X_test: np.ndarray,
                          importance_list: list[np.ndarray],
                          top_k: int = 5) -> tuple[float, list[float]]:
    """
    For each sample, zero out top-k important features and measure how much
    the anomaly probability drops.  A steep drop = high fidelity.

    Returns (mean_DA, per_sample_DA).
    """
    da_scores = []
    for i, imp in enumerate(importance_list):
        x = X_test[i].copy()
        original_pred = predict_fn(x[None])[0]

        top_idx = np.argsort(imp)[-top_k:]
        x_mod = x.copy()
        x_mod[top_idx] = 0.0
        modified_pred = predict_fn(x_mod[None])[0]

        da = abs(original_pred - modified_pred)
        da_scores.append(float(da))

    return float(np.mean(da_scores)), da_scores


# ---------------------------------------------------------------------------
# Sparsity — Mass Around Zero (MAZ)
# ---------------------------------------------------------------------------

def mass_around_zero(importance: np.ndarray, interval_size: float = 0.1) -> float:
    """
    Fraction of features whose importance score < interval_size.
    Higher = sparser = better explanation.
    """
    norm = importance / (importance.max() + 1e-8)
    return float((norm < interval_size).mean())


def maz_curve(importance: np.ndarray, n_points: int = 20) -> tuple[np.ndarray, np.ndarray]:
    intervals = np.linspace(0.0, 1.0, n_points)
    mazes = [mass_around_zero(importance, t) for t in intervals]
    return intervals, np.array(mazes)


# ---------------------------------------------------------------------------
# Stability — top-K intersection across N runs
# ---------------------------------------------------------------------------

def stability_score(importance_runs: np.ndarray, top_k: int = 5) -> float:
    """
    importance_runs: (N, n_features)
    Returns average pairwise Jaccard similarity of top-k feature sets.
    """
    n = len(importance_runs)
    if n < 2:
        return 1.0

    top_sets = [set(np.argsort(run)[-top_k:]) for run in importance_runs]
    sim_sum, count = 0.0, 0
    for i in range(n):
        for j in range(i + 1, n):
            inter = len(top_sets[i] & top_sets[j])
            union = len(top_sets[i] | top_sets[j])
            sim_sum += inter / union if union > 0 else 1.0
            count   += 1

    return float(sim_sum / count) if count > 0 else 1.0


# ---------------------------------------------------------------------------
# Confidence calibration — our novel metric
# ---------------------------------------------------------------------------

def confidence_calibration(bundles) -> dict:
    """
    Measure how well the CA-xNIDS confidence score correlates with
    actual explanation stability.

    A well-calibrated system means high confidence → high stability.
    """
    conf_scores = np.array([b.confidence_score for b in bundles])
    stab_scores = np.array([
        stability_score(b.importance_runs) for b in bundles
    ])

    # Pearson correlation
    corr = float(np.corrcoef(conf_scores, stab_scores)[0, 1])

    # Binned precision: split into HIGH/MEDIUM/LOW and compare mean stability
    high_mask   = conf_scores >= 0.75
    medium_mask = (conf_scores >= 0.50) & ~high_mask
    low_mask    = conf_scores < 0.50

    return {
        'pearson_correlation':      corr,
        'high_conf_mean_stability': float(stab_scores[high_mask].mean())   if high_mask.any()   else 0.0,
        'med_conf_mean_stability':  float(stab_scores[medium_mask].mean())  if medium_mask.any() else 0.0,
        'low_conf_mean_stability':  float(stab_scores[low_mask].mean())     if low_mask.any()    else 0.0,
        'conf_scores': conf_scores,
        'stab_scores': stab_scores,
    }


# ---------------------------------------------------------------------------
# Summary printer
# ---------------------------------------------------------------------------

def print_evaluation_summary(bundles, X_test_flat: np.ndarray,
                              predict_fn, top_k: int = 5):
    print("\n" + "=" * 60)
    print("  EVALUATION SUMMARY")
    print("=" * 60)

    imp_list = [b.mean_importance for b in bundles]

    # Fidelity
    mean_da, _ = descriptive_accuracy(predict_fn, X_test_flat[:len(imp_list)],
                                      imp_list, top_k=top_k)
    print(f"\n[Fidelity]  Mean Descriptive Accuracy (DA): {mean_da:.4f}")

    # Sparsity
    all_imp = np.stack(imp_list)
    maz = mass_around_zero(all_imp.mean(axis=0))
    print(f"[Sparsity]  Mass-Around-Zero (MAZ, t=0.1) : {maz:.4f}")

    # Stability
    stab_scores = [stability_score(b.importance_runs, top_k) for b in bundles]
    print(f"[Stability] Mean Jaccard Stability         : {np.mean(stab_scores):.4f}")

    # Confidence calibration
    cal = confidence_calibration(bundles)
    print(f"\n[CA-xNIDS Confidence Calibration]")
    print(f"  Pearson(confidence, stability) = {cal['pearson_correlation']:.4f}")
    print(f"  HIGH   conf samples → stability = {cal['high_conf_mean_stability']:.4f}")
    print(f"  MEDIUM conf samples → stability = {cal['med_conf_mean_stability']:.4f}")
    print(f"  LOW    conf samples → stability = {cal['low_conf_mean_stability']:.4f}")
    print("=" * 60)

    return {
        'mean_da': mean_da,
        'maz': maz,
        'mean_stability': float(np.mean(stab_scores)),
        'calibration': cal,
    }
