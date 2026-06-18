"""
CA-xNIDS: Confidence-Aware Extension to xNIDS  — OUR CONTRIBUTION
==================================================================

Gap identified in the paper
-----------------------------
xNIDS uses a stochastic explanation process (random sampling of history inputs,
random perturbations).  The paper evaluates *stability* as a metric but DOES NOT
use that stability information to guide defence-rule generation.  Consequently:

  • Low-stability explanations may auto-generate defence rules that block benign
    traffic — creating false positives.
  • Operators have no signal to distinguish trustworthy auto-generated rules from
    unreliable ones.

Our Solution: Bootstrap Confidence Quantification
-------------------------------------------------
1. Run the xNIDS explanation N=10 times with different random seeds.
2. For each feature, compute the Coefficient of Variation (CV) = σ/μ across runs.
3. Overall confidence = 1 - mean(CV over top-k features).
4. Tier the auto-generation decision:
     HIGH   (conf ≥ 0.75): auto-generate and deploy defence rule
     MEDIUM (0.50 ≤ conf < 0.75): generate rule but require operator approval
     LOW    (conf < 0.50): do NOT auto-generate; flag for manual analysis

Benefit: Operators spend review effort only where needed, and the quality of
automatically deployed rules is substantially higher.
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from typing import Callable


# ---------------------------------------------------------------------------
# Confidence thresholds (tunable by operator policy)
# ---------------------------------------------------------------------------
HIGH_CONF_THRESH   = 0.75
MEDIUM_CONF_THRESH = 0.50


@dataclass
class ExplanationBundle:
    """All N bootstrap runs for a single sample, plus aggregated statistics."""
    importance_runs:    np.ndarray          # (N, n_features)
    mean_importance:    np.ndarray          # (n_features,)
    std_importance:     np.ndarray          # (n_features,)
    cv_per_feature:     np.ndarray          # (n_features,) coefficient of variation
    confidence_score:   float               # scalar ∈ [0, 1]
    confidence_tier:    str                 # 'HIGH' | 'MEDIUM' | 'LOW'
    group_importance:   dict = field(default_factory=dict)


def _coefficient_of_variation(values: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    """CV = std / (mean + eps) — bounded to [0, 1] by clipping."""
    return np.clip(values.std(axis=0) / (values.mean(axis=0) + eps), 0.0, 1.0)


def _tier(score: float) -> str:
    if score >= HIGH_CONF_THRESH:
        return 'HIGH'
    if score >= MEDIUM_CONF_THRESH:
        return 'MEDIUM'
    return 'LOW'


# ---------------------------------------------------------------------------
# Core: Bootstrap Confidence Estimator
# ---------------------------------------------------------------------------

class BootstrapConfidence:
    """
    Wraps an xNIDSExplainer and runs it N times with different seeds to
    estimate the confidence of the explanation for a single sample.

    Parameters
    ----------
    explainer   : xNIDSExplainer instance
    n_bootstrap : number of bootstrap runs (default 10, paper uses 10 for stability)
    top_k       : number of top features used when computing mean CV
    base_seed   : base random seed (individual seeds = base_seed + i)
    """

    def __init__(self, explainer, n_bootstrap: int = 10,
                 top_k: int = 5, base_seed: int = 0):
        self.explainer    = explainer
        self.n_bootstrap  = n_bootstrap
        self.top_k        = top_k
        self.base_seed    = base_seed

    # ------------------------------------------------------------------
    def estimate(self, predict_fn: Callable,
                 x_current: np.ndarray,
                 X_history: np.ndarray) -> ExplanationBundle:
        """
        Run N bootstrap explanations and return aggregated statistics.
        """
        all_runs = []
        for i in range(self.n_bootstrap):
            imp, _ = self.explainer.explain(
                predict_fn, x_current, X_history,
                seed=self.base_seed + i
            )
            all_runs.append(imp)

        runs = np.array(all_runs)               # (N, n_features)
        mean_imp = runs.mean(axis=0)
        std_imp  = runs.std(axis=0)
        cv       = _coefficient_of_variation(runs)

        # Focus confidence on the top-k most important features
        top_k_idx = np.argsort(mean_imp)[-self.top_k:]
        conf = float(1.0 - cv[top_k_idx].mean())
        conf = max(0.0, min(1.0, conf))         # clamp to [0, 1]

        # Group importance from mean run
        group_imp = {
            gname: float(mean_imp[idx].mean())
            for gname, idx in self.explainer.feature_groups.items()
        }

        return ExplanationBundle(
            importance_runs   = runs,
            mean_importance   = mean_imp,
            std_importance    = std_imp,
            cv_per_feature    = cv,
            confidence_score  = conf,
            confidence_tier   = _tier(conf),
            group_importance  = group_imp,
        )


# ---------------------------------------------------------------------------
# Batch evaluation helper
# ---------------------------------------------------------------------------

def batch_confidence(explainer, predict_fn: Callable,
                     X_flat: np.ndarray,
                     history_len: int = 5,
                     n_bootstrap: int = 10,
                     top_k: int = 5,
                     verbose: bool = True) -> list[ExplanationBundle]:
    """
    Run CA-xNIDS on every sample in X_flat (shape: n, features).
    Uses a sliding-window of `history_len` preceding samples as history.

    Returns a list of ExplanationBundle objects, one per sample
    (indices history_len … n-1).
    """
    bc = BootstrapConfidence(explainer, n_bootstrap=n_bootstrap, top_k=top_k)
    bundles = []
    n = len(X_flat)

    for i in range(history_len, n):
        x_cur  = X_flat[i]
        x_hist = X_flat[i - history_len: i]
        bundle = bc.estimate(predict_fn, x_cur, x_hist)
        bundles.append(bundle)

        if verbose and (i - history_len) % 10 == 0:
            print(f"    sample {i - history_len + 1}/{n - history_len} | "
                  f"conf={bundle.confidence_score:.3f} [{bundle.confidence_tier}]")

    return bundles


# ---------------------------------------------------------------------------
# Summary statistics for a collection of bundles
# ---------------------------------------------------------------------------

def summarise_confidence(bundles: list[ExplanationBundle]) -> dict:
    scores = np.array([b.confidence_score for b in bundles])
    tiers  = [b.confidence_tier for b in bundles]
    return {
        'mean_confidence':  float(scores.mean()),
        'std_confidence':   float(scores.std()),
        'min_confidence':   float(scores.min()),
        'max_confidence':   float(scores.max()),
        'n_high':           tiers.count('HIGH'),
        'n_medium':         tiers.count('MEDIUM'),
        'n_low':            tiers.count('LOW'),
        'pct_high':         100 * tiers.count('HIGH')   / len(tiers),
        'pct_medium':       100 * tiers.count('MEDIUM') / len(tiers),
        'pct_low':          100 * tiers.count('LOW')    / len(tiers),
    }
