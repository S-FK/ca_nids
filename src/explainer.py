"""
xNIDS explanation engine — simplified faithful re-implementation.

Key ideas from the paper:
  1. Approximate the relevant history inputs (Sec 3.2)
  2. Sample around those history inputs using Weighted Random Sampling (Sec 3.3)
  3. Capture feature dependencies via sparse group lasso (Sec 3.4)
  4. Derive per-feature importance scores β used for defense rule generation
"""
import numpy as np
from sklearn.linear_model import Lasso, Ridge


# ---------------------------------------------------------------------------
# History input approximation
# ---------------------------------------------------------------------------

class HistoryApproximator:
    """
    Find the minimal relevant set of history inputs l such that
    |f(x_t, X_{t,l}) - f(x_t, X_{t,k})| < δ.

    Simplified: we use all history_len inputs and weight by recency.
    """
    def __init__(self, delta: float = 1e-2, max_updates: int = 10):
        self.delta = delta
        self.max_updates = max_updates

    def find_relevant(self, predict_fn, x_current: np.ndarray,
                      X_history: np.ndarray) -> np.ndarray:
        """Return the subset of history inputs relevant to the current prediction."""
        full_pred = predict_fn(x_current[None])[0]
        l = len(X_history)

        for _ in range(self.max_updates):
            subset = X_history[-l:]
            subset_pred = predict_fn(np.vstack([x_current[None]] * len(subset)))[0]
            if abs(full_pred - subset_pred) < self.delta or l <= 1:
                break
            l = max(1, l // 2)

        return X_history[-l:]


# ---------------------------------------------------------------------------
# Weighted Random Sampling (WRS) around history inputs
# ---------------------------------------------------------------------------

class WeightedRandomSampler:
    """
    Assign higher probability to the most recent history inputs (Eq. 6 in paper).
    Decay options: 'gaussian' (default), 'exponential', 'linear'.
    """
    def __init__(self, decay: str = 'gaussian', sigma: float = 1.5):
        self.decay = decay
        self.sigma = sigma

    def decay_weights(self, n: int) -> np.ndarray:
        pos = np.arange(n, dtype=float)
        if self.decay == 'gaussian':
            w = np.exp(-pos ** 2 / (2 * self.sigma ** 2))
        elif self.decay == 'exponential':
            w = np.exp(-pos)
        else:   # linear
            w = 1.0 / (pos + 1)
        w = w[::-1]   # most-recent = highest weight
        return w / w.sum()

    def sample(self, x_current: np.ndarray, X_history: np.ndarray,
               n_samples: int = 150, noise_std: float = 0.05,
               rng: np.random.RandomState | None = None) -> np.ndarray:
        """
        Draw n_samples perturbations: include x_current, then sample from
        history inputs proportionally to their decay weights.
        """
        if rng is None:
            rng = np.random.RandomState()

        weights = self.decay_weights(len(X_history))
        samples = [x_current.copy()]

        for _ in range(n_samples - 1):
            idx = rng.choice(len(X_history), p=weights)
            base = X_history[idx]
            noise = rng.normal(0, noise_std, size=base.shape)
            samples.append(base + noise)

        return np.array(samples, dtype=np.float32)


# ---------------------------------------------------------------------------
# Sparse Group Lasso (simplified: per-group Lasso to preserve group structure)
# ---------------------------------------------------------------------------

class SparseGroupLasso:
    """
    Approximate sparse group lasso by running a standard Lasso regression
    on the synthesised samples and then enforcing group-level sparsity by
    zeroing out groups whose mean coefficient is below a threshold.

    This captures both group-level and feature-level sparsity (Eq. 9-12).
    """
    def __init__(self, feature_groups: dict, alpha: float = 0.01,
                 group_threshold: float = 0.001):
        self.feature_groups = feature_groups
        self.alpha = alpha
        self.group_threshold = group_threshold

    def fit(self, Z: np.ndarray, y: np.ndarray) -> np.ndarray:
        """
        Fit a sparse linear model on synthesised samples Z with labels y.
        Returns per-feature importance scores in [0, 1].
        Falls back to Ridge regression when Lasso over-regularises to all-zero.
        """
        lasso = Lasso(alpha=self.alpha, fit_intercept=True, max_iter=20000)
        lasso.fit(Z, y)
        coef = np.abs(lasso.coef_)

        # Fallback: if Lasso kills everything, use Ridge for at least some signal
        if coef.max() < 1e-8:
            ridge = Ridge(alpha=0.01, fit_intercept=True)
            ridge.fit(Z, y)
            coef = np.abs(ridge.coef_)

        # Group-level sparsity: zero out unimportant groups
        for indices in self.feature_groups.values():
            group_mean = coef[indices].mean()
            if group_mean < self.group_threshold:
                coef[indices] = 0.0

        # Normalise to [0, 1]
        max_val = coef.max()
        if max_val > 0:
            coef = coef / max_val
        return coef


# ---------------------------------------------------------------------------
# xNIDS Explainer — combines the three steps above
# ---------------------------------------------------------------------------

class xNIDSExplainer:
    """
    Single-sample explanation for a DL-NIDS prediction.

    Explanation strategy (adapted from xNIDS paper):
      1. Generate perturbations of x_current with Gaussian noise (WRS-weighted).
      2. For each perturbation z_i, evaluate the DL-NIDS using real history context
         (the predict_fn must encapsulate the fixed history via a closure so the
         LSTM receives proper [history, z_i] sequences).
      3. Fit sparse group lasso on (z_i, f(z_i)) pairs to identify which features of
         x_current drove the anomaly prediction.

    Usage:
        pfn = trainer.make_explain_predict_fn(X_history, seq_len=6)
        explainer = xNIDSExplainer(feature_groups)
        scores, group_scores = explainer.explain(pfn, x_current, X_history)
    """
    def __init__(self, feature_groups: dict,
                 n_samples: int = 200,
                 noise_std: float = 1.0,
                 decay: str = 'gaussian',
                 alpha: float = 0.01,
                 random_state: int | None = None):
        self.feature_groups = feature_groups
        self.n_samples = n_samples
        self.noise_std = noise_std
        self.decay = decay
        self.sgl = SparseGroupLasso(feature_groups, alpha=alpha)
        self.random_state = random_state

    # ------------------------------------------------------------------
    def _sample_around_current(self, x_current: np.ndarray,
                                X_history: np.ndarray,
                                rng: np.random.RandomState) -> np.ndarray:
        """
        Sample n_samples perturbations of x_current using Weighted Random Sampling.

        WRS assigns higher weight to features that resemble the most recent history,
        focusing the local neighbourhood on the relevant region of feature space.
        """
        # Decay weights for history inputs (most recent = highest weight)
        n_hist = len(X_history)
        positions = np.arange(n_hist, dtype=float)
        if self.decay == 'gaussian':
            w = np.exp(-positions[::-1] ** 2 / 2.0)
        else:
            w = np.exp(-positions[::-1])
        w = w / w.sum()

        # Choose anchor history inputs according to w
        anchors = X_history[rng.choice(n_hist, size=self.n_samples - 1, p=w)]
        # Interpolate between x_current and anchor, then add noise
        t = rng.uniform(0, 1, size=(self.n_samples - 1, 1))
        Z = t * x_current + (1 - t) * anchors
        Z += rng.normal(0, self.noise_std, size=Z.shape).astype(np.float32)

        # Always include the original sample as the first element
        return np.vstack([x_current[None], Z]).astype(np.float32)

    # ------------------------------------------------------------------
    def explain(self, predict_fn, x_current: np.ndarray,
                X_history: np.ndarray,
                seed: int | None = None) -> tuple[np.ndarray, dict]:
        """
        Returns
        -------
        importance : np.ndarray, shape (n_features,)
            Per-feature importance scores in [0, 1].
        group_importance : dict
            Group-level mean importance scores.
        """
        rng = np.random.RandomState(seed if seed is not None else self.random_state)

        # Step 1: sample in the neighbourhood of x_current (history-weighted)
        Z = self._sample_around_current(x_current, X_history, rng)

        # Step 2: evaluate the DL-NIDS — predict_fn must embed history context
        y_synth = predict_fn(Z)

        # Step 3: sparse group lasso on (Z, y_synth) → per-feature importance
        importance = self.sgl.fit(Z, y_synth)

        group_importance = {
            gname: float(importance[idx].mean())
            for gname, idx in self.feature_groups.items()
        }

        return importance, group_importance
