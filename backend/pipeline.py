"""
ML Pipeline for the CA-xNIDS dashboard backend.
Wraps the existing src/ modules: LSTM detection, xNIDS explanation, CA-xNIDS confidence.
"""
import sys, os, pickle, threading
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.data_loader  import KDDDataLoader, FEATURE_GROUPS, FEATURE_NAMES
from src.model        import DLNIDSTrainer
from src.explainer    import xNIDSExplainer
from src.confidence   import BootstrapConfidence
from src.defense_rules import DefenceRuleGenerator

MODEL_PATH = os.path.join(os.path.dirname(__file__), "nids_model.pth")
CACHE_PATH = os.path.join(os.path.dirname(__file__), "data_cache.pkl")

# Map numeric indices to attack type labels (weighted approximation of KDD99 distribution)
ATTACK_TYPES  = ["DoS", "Probe", "R2L", "U2R"]
ATTACK_WEIGHTS = [0.62, 0.22, 0.12, 0.04]


class MLPipeline:
    def __init__(self):
        self.trainer       = None
        self.explainer     = None
        self.bc            = None
        self.gen           = DefenceRuleGenerator()
        self.normal_pool   = None
        self.attack_pool   = None
        self.attack_labels = None   # per-sample attack type string
        self.normal_hist   = None   # fixed normal history for explanations
        self.n_features    = 41
        self._ready        = False
        self._status       = "initializing"
        self._lock         = threading.Lock()

    # ── public API ──────────────────────────────────────────────────────────

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def status(self) -> str:
        return self._status

    def setup(self):
        """Blocking setup — call in a daemon thread from FastAPI lifespan."""
        try:
            self._load_or_build()
        except Exception as exc:
            self._status = f"error: {exc}"
            raise

    def sample_normal(self) -> np.ndarray:
        idx = np.random.randint(len(self.normal_pool))
        return self.normal_pool[idx]

    def sample_attack(self):
        """Returns (features, attack_type_label)."""
        idx = np.random.randint(len(self.attack_pool))
        return self.attack_pool[idx], self.attack_labels[idx]

    def detect(self, x_current: np.ndarray, x_history: np.ndarray) -> float:
        with self._lock:
            pfn = self.trainer.make_explain_predict_fn(x_history, seq_len=6)
            return float(pfn(x_current[None])[0])

    def raw_features(self, x: np.ndarray) -> dict:
        """Return top-15 feature name→value pairs for display."""
        return {FEATURE_NAMES[i]: round(float(x[i]), 4) for i in range(len(FEATURE_NAMES))}

    # ── xNIDS explanation (paper method: single run, no confidence) ──────────

    def explain_xnids(self, x_current: np.ndarray, x_history: np.ndarray) -> dict:
        """Single-run xNIDS explanation — mirrors the paper exactly.
        No bootstrap, no confidence score. Rules are always auto-deployed."""
        with self._lock:
            pfn  = self.trainer.make_explain_predict_fn(x_history, seq_len=6)
            imp, group_imp = self.explainer.explain(pfn, x_current, x_history, seed=42)
            rule = self.gen.generate(
                importance      = imp,
                group_importance= group_imp,
                X_current       = x_current,
                confidence      = 1.0,
                confidence_tier = "HIGH",
            )

        top_idx   = np.argsort(imp)[-8:][::-1]
        top_feats = [
            {
                "name":       FEATURE_NAMES[i],
                "importance": round(float(imp[i]), 4),
                "std":        0.0,
                "group":      next((g for g, idxs in FEATURE_GROUPS.items() if i in idxs), "other"),
            }
            for i in top_idx if imp[i] > 0.01
        ]

        return {
            "features":         top_feats,
            "group_importance": {k: round(float(v), 4) for k, v in group_imp.items()},
            "confidence":       None,   # xNIDS does not compute confidence
            "tier":             "HIGH", # always deploys rule
            "iptables_rule":    rule.to_iptables(),
            "openflow_rule":    rule.to_openflow(),
            "scope":            rule.scope,
            "review_required":  False,
            "explanation_mode": "xnids",
        }

    # ── CA-xNIDS explanation (our contribution: bootstrap + confidence) ───────

    def explain(self, x_current: np.ndarray, x_history: np.ndarray) -> dict:
        """Run xNIDS + CA-xNIDS, generate defence rule. Returns serialisable dict."""
        with self._lock:
            pfn    = self.trainer.make_explain_predict_fn(x_history, seq_len=6)
            bundle = self.bc.estimate(pfn, x_current, x_history)
            rule   = self.gen.generate(
                importance      = bundle.mean_importance,
                group_importance= bundle.group_importance,
                X_current       = x_current,
                confidence      = bundle.confidence_score,
                confidence_tier = bundle.confidence_tier,
            )

        top_idx   = np.argsort(bundle.mean_importance)[-8:][::-1]
        top_feats = [
            {
                "name":       FEATURE_NAMES[i],
                "importance": round(float(bundle.mean_importance[i]), 4),
                "std":        round(float(bundle.std_importance[i]),  4),
                "group":      next(
                    (g for g, idxs in FEATURE_GROUPS.items() if i in idxs), "other"
                ),
            }
            for i in top_idx
            if bundle.mean_importance[i] > 0.01
        ]

        return {
            "features":         top_feats,
            "group_importance": {k: round(float(v), 4)
                                 for k, v in bundle.group_importance.items()},
            "confidence":       round(bundle.confidence_score, 4),
            "tier":             bundle.confidence_tier,
            "iptables_rule":    rule.to_iptables(),
            "openflow_rule":    rule.to_openflow(),
            "scope":            rule.scope,
            "review_required":  rule.review_required,
            "explanation_mode": "ca_xnids",
        }

    # ── private helpers ──────────────────────────────────────────────────────

    def _load_or_build(self):
        # ── 1. Data ──────────────────────────────────────────────────────────
        self._status = "loading_data"
        if os.path.exists(CACHE_PATH):
            print("[pipeline] Loading cached data …")
            with open(CACHE_PATH, "rb") as f:
                cache = pickle.load(f)
        else:
            print("[pipeline] Downloading & preprocessing KDD99 …")
            loader = KDDDataLoader(history_len=5)
            (X_tr_seq, y_tr_seq, X_te_seq, y_te_seq,
             X_tr_flat, X_te_flat, y_tr_flat, y_te_flat) = loader.load()
            self.n_features = loader.n_features
            cache = dict(
                X_tr_seq=X_tr_seq, y_tr_seq=y_tr_seq,
                X_te_flat=X_te_flat, y_te_flat=y_te_flat,
                n_features=self.n_features,
            )
            with open(CACHE_PATH, "wb") as f:
                pickle.dump(cache, f)
            print("[pipeline] Data cached.")

        X_tr_seq     = cache["X_tr_seq"]
        y_tr_seq     = cache["y_tr_seq"]
        X_te_flat    = cache["X_te_flat"]
        y_te_flat    = cache["y_te_flat"]
        self.n_features = int(cache["n_features"])

        # Build sample pools for simulation
        atk_idx  = np.where(y_te_flat == 1)[0]
        norm_idx = np.where(y_te_flat == 0)[0]
        self.attack_pool   = X_te_flat[atk_idx]
        self.normal_pool   = X_te_flat[norm_idx]
        self.attack_labels = np.random.choice(
            ATTACK_TYPES, size=len(atk_idx), p=ATTACK_WEIGHTS
        )
        # Fixed normal history context for explanation
        self.normal_hist = X_te_flat[norm_idx[:5]]

        # ── 2. Model ──────────────────────────────────────────────────────────
        self.trainer = DLNIDSTrainer(
            input_size=self.n_features, hidden_size=64,
            num_layers=2, dropout=0.2,
        )
        if os.path.exists(MODEL_PATH):
            self._status = "loading_model"
            print("[pipeline] Loading saved model …")
            self.trainer.load(MODEL_PATH)
        else:
            self._status = "training"
            print("[pipeline] Training LSTM DL-NIDS …")
            self.trainer.train(X_tr_seq, y_tr_seq, epochs=15, batch_size=512)
            self.trainer.save(MODEL_PATH)
            print("[pipeline] Model saved.")

        # ── 3. Explainer ──────────────────────────────────────────────────────
        self.explainer = xNIDSExplainer(
            FEATURE_GROUPS, n_samples=150, noise_std=1.0, alpha=0.01
        )
        self.bc = BootstrapConfidence(self.explainer, n_bootstrap=10, top_k=5)

        self._ready  = True
        self._status = "ready"
        print("[pipeline] Ready.")
