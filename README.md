# CA-xNIDS: Confidence-Aware Explainability for Deep Learning-based Network Intrusion Detection Systems

**CSL6010 Major Project — IIT Jodhpur M.Tech (AI)**  
Based on: *xNIDS: Explaining Deep Learning-based Network Intrusion Detection Systems for Active Intrusion Responses*  
(USENIX Security 2023, Feng Wei et al.)

---

## Table of Contents

1. [What This Project Is](#what-this-project-is)
2. [The Gap in the Paper](#the-gap-in-the-paper)
3. [Our Contribution — CA-xNIDS](#our-contribution--ca-xnids)
4. [System Architecture](#system-architecture)
5. [Project Structure](#project-structure)
6. [Installation](#installation)
7. [Running the Demo (CLI)](#running-the-demo-cli)
8. [Running the Dashboard App](#running-the-dashboard-app)
9. [Using the Dashboard](#using-the-dashboard)
10. [Detection Modes](#detection-modes)
11. [Module Reference](#module-reference)
12. [Backend API Reference](#backend-api-reference)
13. [Evaluation Metrics](#evaluation-metrics)
14. [Key Results](#key-results)
15. [Output Plots](#output-plots)

---

## What This Project Is

This project re-implements and significantly extends the **xNIDS** framework from USENIX Security 2023. xNIDS is a system that:

1. Uses an LSTM-based deep learning model to detect network intrusions in real time.
2. When an intrusion is detected, runs a LIME-based explanation to identify *which features* of the packet caused the alert.
3. Translates that explanation into a concrete defence rule (iptables / OpenFlow) and auto-deploys it.

Our extension, **CA-xNIDS (Confidence-Aware xNIDS)**, adds a bootstrap confidence scoring layer between explanation and rule deployment. Instead of blindly auto-deploying every rule, the system asks: *"how reliable is this explanation?"* and gates deployment on the answer.

The project ships two interfaces:
- A **CLI pipeline** (`python -m src.main`) that trains the model, runs explanations on 60 samples, evaluates metrics, and saves 8 plots.
- An **interactive web dashboard** (FastAPI + React) that streams live detections, lets you inject traffic on demand, and visually compares the two detection modes.

---

## The Gap in the Paper

xNIDS generates explanations using stochastic sampling (Weighted Random Sampling + Sparse Group Lasso). Because sampling is random, running the same explanation twice with different seeds can produce different top features. The paper evaluates *stability* as a metric but **never uses it to gate rule generation**. Consequences:

- Low-stability (unreliable) explanations can auto-generate defence rules that block benign traffic.
- Operators have no signal to distinguish trustworthy auto-generated rules from unreliable ones.
- There is no operator review workflow — every detected attack immediately deploys a rule.

---

## Our Contribution — CA-xNIDS

We add a **Bootstrap Confidence Score** layer.

**Algorithm:**
1. Run the xNIDS explanation N = 10 times with different random seeds.
2. For each of the 41 features, compute the Coefficient of Variation (CV = σ/μ) across the 10 runs.
3. Focus on the top-k = 5 most important features (the ones that would drive the rule).
4. Confidence = 1 − mean(CV over top-k features). Clamped to [0, 1].

**Confidence Tiers and Rule Gating:**

| Tier | Threshold | Action |
|------|-----------|--------|
| HIGH | ≥ 0.75 | Auto-deploy the defence rule |
| MEDIUM | 0.50 – 0.75 | Generate rule, require operator approval |
| LOW | < 0.50 | Do NOT auto-generate; flag for manual analysis |

**Why this works:** Clear attacks (well-separated from normal traffic) produce stable explanations across seeds → high confidence → HIGH tier → auto-deploy. Evasion/borderline samples produce unstable explanations → low confidence → LOW tier → no auto-deploy. The Pearson correlation between confidence and actual Jaccard stability is **r = 0.83**, validating the approach.

---

## System Architecture

```
                        KDD Cup 99 Traffic
                               │
                    ┌──────────▼──────────┐
                    │    LSTM DL-NIDS      │   2-layer LSTM (64 hidden units)
                    │  (seq_len = 6)       │   binary classification: normal / attack
                    └──────────┬──────────┘
                               │  anomaly probability > 0.5
                               ▼
                    ┌──────────────────────┐
                    │   xNIDS Explainer    │   Weighted Random Sampling (WRS)
                    │  (history-aware)     │ + Sparse Group Lasso (SGL)
                    │                      │   → feature importance β ∈ [0,1]^41
                    └──────────┬───────────┘
                               │
              ┌────────────────┴─────────────────┐
              │  xNIDS mode                      │  CA-xNIDS mode
              │  (paper, single run)             │  (ours, 10 bootstrap runs)
              │                                  │
              │  importance β                    │  mean β, std β, confidence score
              │  tier = HIGH (always)            │  tier = HIGH / MEDIUM / LOW
              └──────────┬───────────────────────┘
                         │
               ┌─────────▼──────────┐
               │  Defence Rule Gen  │   entity, action, priority, timeout
               │                    │   scope: per-flow | per-host | multi-hosts
               └─────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
       HIGH            MEDIUM           LOW
    Auto-deploy      Needs review    Manual only
    iptables /       flag for        no rule
    OpenFlow rule    operator        generated
```

---

## Project Structure

```
Group Project/
│
├── src/                        Core ML library (framework-independent)
│   ├── data_loader.py          KDD Cup 99 loading, preprocessing, feature groups
│   ├── model.py                LSTM DL-NIDS (PyTorch) + DLNIDSTrainer
│   ├── explainer.py            xNIDS explanation: WRS + Sparse Group Lasso
│   ├── confidence.py           CA-xNIDS: bootstrap confidence scoring  ← OUR CONTRIBUTION
│   ├── defense_rules.py        Unified defence rule generation (OpenFlow / iptables)
│   ├── evaluate.py             Metrics: Fidelity (DA), Sparsity (MAZ), Stability, Calibration
│   ├── visualize.py            8 output plots + dashboard
│   └── main.py                 Full CLI pipeline demo
│
├── backend/                    FastAPI server
│   ├── main.py                 REST endpoints + WebSocket
│   ├── pipeline.py             Wraps src/ for live inference and explanation
│   ├── simulator.py            Auto-streams KDD99 traffic over WebSocket
│   ├── state.py                Shared sim state (running, mode, inject queue)
│   ├── nids_model.pth          Saved LSTM weights (auto-created on first run)
│   └── data_cache.pkl          Preprocessed KDD99 cache (auto-created on first run)
│
├── frontend/                   React + TypeScript dashboard
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.tsx     KPI cards, attack type chart, live traffic
│       │   ├── ControlPage.tsx       Start/stop, detection mode selector, packet injection
│       │   ├── AttacksPage.tsx       Attack event log with explanation details
│       │   └── DetectionPage.tsx     Live packet stream with per-packet probabilities
│       ├── components/
│       │   ├── Header.tsx            Global start/stop button, mode badge, attack ticker
│       │   ├── AlertBanner.tsx       Real-time attack alert overlay
│       │   ├── KPICards.tsx          Total packets, attacks, auto-deployed, needs review
│       │   ├── LiveTrafficChart.tsx  Scrolling anomaly probability timeline
│       │   ├── AttackTypeChart.tsx   DoS / Probe / R2L / U2R breakdown
│       │   ├── FeatureImportance.tsx Top feature bars with std uncertainty
│       │   ├── ConfidenceGauge.tsx   Circular confidence score gauge
│       │   ├── DefenceRules.tsx      iptables / OpenFlow rule display
│       │   └── AttackLog.tsx         Paginated attack history
│       ├── store/useStore.ts         Zustand global state
│       ├── hooks/useAttackStream.ts  WebSocket connection + packet dispatch
│       └── types.ts                 Shared TypeScript types
│
├── data/                       Auto-populated by sklearn on first run
├── results/                    Output plots (auto-created by CLI demo)
├── start.sh                    One-command launcher for backend + frontend
├── requirements.txt            Python dependencies
└── usenixsecurity23-wei-feng.pdf  Original xNIDS paper
```

---

## Installation

### Python dependencies

```bash
pip install -r requirements.txt
```

Core libraries: `torch`, `numpy`, `scikit-learn`, `pandas`, `matplotlib`, `scipy`, `python-pptx`, `fastapi`, `uvicorn`.

### Frontend dependencies

```bash
cd frontend
npm install
```

---

## Running the Demo (CLI)

```bash
# From the project root:
python -m src.main
```

The KDD Cup 99 dataset (~18 MB) downloads automatically via `sklearn.datasets.fetch_kddcup99` on the first run.

Expected runtime: ~2–4 minutes (LSTM training) + ~1 minute (bootstrap explanations on 60 samples).

### What happens step by step

| Step | Description |
|------|-------------|
| 1 | Load & preprocess KDD Cup 99: 100,655 samples, 41 features, binary labels |
| 2 | Train 2-layer LSTM DL-NIDS (15 epochs, batch 512, Adam lr=1e-3) |
| 3 | Build 60-sample set: 30 clear attacks + 30 hard/borderline (15% attack + 85% normal features) |
| 4 | Run single xNIDS explanation on a clear attack, print group importances |
| 5 | Run CA-xNIDS (N=10 bootstrap) on all 60 samples, print confidence breakdown |
| 6 | Evaluate Fidelity (DA), Sparsity (MAZ), Stability (Jaccard), Calibration (Pearson r) |
| 7 | Generate confidence-gated defence rules, print sample iptables and OpenFlow rules |
| 8 | Save 8 visualisation plots to `results/` |

---

## Running the Dashboard App

```bash
bash start.sh
```

This starts the FastAPI backend on port 8000 and the Vite frontend dev server on port 5173 (proxied through the backend). Open **http://localhost:5173** in your browser.

### What happens on startup

1. The backend loads (or trains) the LSTM model and preprocesses KDD99 data.
2. A loading screen shows progress (`Downloading KDD Cup 99 dataset…` → `Training LSTM DL-NIDS…` → `Loading saved model weights…`).
3. Once ready, the WebSocket connects and the dashboard becomes interactive.
4. On subsequent runs the cached model (`backend/nids_model.pth`) and data (`backend/data_cache.pkl`) load in seconds.

---

## Using the Dashboard

### Dashboard (default page `/`)

The home screen. Shows:
- **KPI cards** — total packets processed, total attacks detected, auto-deployed rules, rules needing review, manual-only rules.
- **Live Traffic Chart** — scrolling timeline of anomaly probability for each packet. Spikes show where attacks were detected.
- **Attack Type Distribution** — pie/bar breakdown of DoS, Probe, R2L, U2R.
- **Recent Alerts** — the last few attack events.

### Control Center (`/control`)

Where you control the monitoring engine.

**System Status card** — shows current monitoring state (ACTIVE / STOPPED), total packets, packet rate, and attacks detected. Also explains that when monitoring starts the engine auto-streams KDD99 packets at ~4 Hz and auto-injects attack bursts every ~25 packets — no manual injection is needed to see detections.

**Start / Stop Monitoring** — toggles the live simulation. The same toggle is available in the top-right corner of the Header on every page.

**Detection Mode card** — choose which explanation method is used for each detected attack:
- **xNIDS (Paper)** — single-run LIME explanation, no confidence score, rules always auto-deployed.
- **CA-xNIDS (Ours)** — 10-run bootstrap LIME, produces a confidence score (0–1) and confidence tier (HIGH/MEDIUM/LOW), gates rule deployment accordingly.

The active mode is shown as a badge in the header on every page.

**Normal Traffic** — manually inject 1, 5, 10, 25, or 50 benign packets on demand. These should pass through without triggering alerts.

**Malicious Request** — manually inject attack packets of a chosen type (DoS, Probe, R2L, U2R) with a chosen count (1–20). Useful for testing detection on demand even when auto-monitoring is stopped.

**Injection Log** — terminal-style log of all manual injections.

### Attack Studio (`/attacks`)

Full event log of every detected attack. Each entry shows:
- Packet ID, timestamp, attack type, anomaly probability.
- Top feature importances (with uncertainty bars in CA-xNIDS mode).
- Group importance breakdown (basic, content, time_traffic, host_traffic).
- Confidence gauge (CA-xNIDS mode only).
- Generated iptables and OpenFlow defence rules.
- Whether the rule was auto-deployed, flagged for review, or manual-only.

### Live Detection (`/detection`)

Raw packet stream table showing every processed packet in real time:
- Packet ID, timestamp, source (auto / manual).
- Anomaly probability as a progress bar.
- Attack / Normal label.
- Confidence tier badge (CA-xNIDS mode).

---

## Detection Modes

The system ships two explanation modes selectable at runtime.

### xNIDS Mode (Paper)

Mirrors the original USENIX Security 2023 paper exactly.

- Single LIME-style run per attack: sample 200 perturbations around the current packet using Weighted Random Sampling, fit a Sparse Group Lasso to identify top features.
- No confidence score is computed.
- Confidence tier is always set to HIGH.
- Every detected attack immediately generates and deploys a defence rule.

Use this mode to reproduce the baseline behaviour described in the paper.

### CA-xNIDS Mode (Ours)

Our contribution.

- Runs the same explanation 10 times with different random seeds.
- Computes Coefficient of Variation (σ/μ) per feature across runs.
- Confidence = 1 − mean(CV over top-5 features).
- Assigns a tier: HIGH (≥ 0.75) → auto-deploy; MEDIUM (0.50–0.75) → needs review; LOW (< 0.50) → manual only.
- The Dashboard shows confidence as a circular gauge and uncertainty bars on feature importance charts.

The active mode applies to all future packets — already-logged events retain the mode they were processed under (shown as `explanation_mode` in each event).

---

## Module Reference

### `src/data_loader.py`

Loads KDD Cup 99 (`sklearn.datasets.fetch_kddcup99`, subset `'SA'`). Applies one-hot encoding to the three categorical features (protocol_type, service, flag), standard-scales all 41 features, builds sliding-window sequences of length `history_len + 1` for LSTM input.

Exports `FEATURE_NAMES` (list of 41 names) and `FEATURE_GROUPS` (dict mapping group name → list of feature indices):
- `basic` — duration, protocol_type, service, flag, src_bytes, dst_bytes, etc.
- `content` — hot, num_failed_logins, logged_in, num_compromised, etc.
- `time_traffic` — count, srv_count, serror_rate, rerror_rate, etc.
- `host_traffic` — dst_host_count, dst_host_srv_count, dst_host_same_srv_rate, etc.

### `src/model.py`

**`LSTMDetector`** — 2-layer LSTM (hidden=64) followed by a 2-layer MLP classifier with Sigmoid output. Input shape: (batch, seq_len, 41).

**`DLNIDSTrainer`** — wraps LSTMDetector with Adam optimiser and BCELoss. Key methods:
- `train(X_seq, y, epochs, batch_size)` — trains the model.
- `predict_proba(X_seq)` — returns anomaly probability per sample.
- `evaluate(X_seq, y_true)` — prints classification report and ROC-AUC.
- `make_explain_predict_fn(X_history, seq_len)` — returns a closure `fn(X_flat) → probs` that prepends the fixed history context before each forward pass, required by the explainer.
- `save(path)` / `load(path)` — serialise/load model weights.

Auto-selects device: CUDA → MPS → CPU.

### `src/explainer.py`

**`xNIDSExplainer`** — full xNIDS explanation pipeline.

1. `_sample_around_current(x_current, X_history, rng)` — Weighted Random Sampling. Assigns Gaussian decay weights to history inputs (most recent = highest weight), interpolates between `x_current` and sampled history anchors, adds Gaussian noise. Returns `(n_samples, 41)`.
2. Passes samples through `predict_fn` to get anomaly scores.
3. `SparseGroupLasso.fit(Z, y)` — fits a Lasso regression, falls back to Ridge if Lasso zeroes all coefficients, enforces group-level sparsity by zeroing groups with mean coefficient below threshold, normalises to [0, 1].

`explainer.explain(predict_fn, x_current, X_history, seed)` returns `(importance, group_importance)`.

### `src/confidence.py` — Our Contribution

**`BootstrapConfidence`**

```python
bc = BootstrapConfidence(explainer, n_bootstrap=10, top_k=5)
bundle = bc.estimate(predict_fn, x_current, X_history)

bundle.confidence_score   # float ∈ [0, 1]
bundle.confidence_tier    # 'HIGH' | 'MEDIUM' | 'LOW'
bundle.mean_importance    # (41,) — mean feature importance across 10 runs
bundle.std_importance     # (41,) — per-feature std (uncertainty)
bundle.cv_per_feature     # (41,) — coefficient of variation per feature
bundle.importance_runs    # (10, 41) — all individual runs
bundle.group_importance   # dict group → mean importance
```

**`batch_confidence(explainer, predict_fn, X_flat, history_len, ...)`** — convenience function that runs CA-xNIDS on every sample in `X_flat` using a sliding history window.

**`summarise_confidence(bundles)`** — returns dict with mean/std/min/max confidence and counts per tier.

### `src/defense_rules.py`

**`DefenceRuleGenerator`** — converts a feature importance vector into a `UnifiedDefenceRule`.

Scope determination:
- `host_traffic` dominant + `time_traffic` > 0.3 → `multi-hosts`
- `host_traffic` dominant → `per-host`
- anything else → `per-flow`

Action determination (strategy `'assertive'` by default):
- `per-host` → `drop_host`
- `per-flow` → `drop_flow`

CA-xNIDS marks MEDIUM and LOW confidence rules as `review_required = True`.

`UnifiedDefenceRule.to_iptables()` and `.to_openflow()` produce ready-to-use rule strings.

**`generate_rules_batch(bundles, X_flat, ...)`** — batch rule generation returning `{'auto_deploy': [...], 'needs_review': [...], 'manual_only': [...]}`.

### `src/evaluate.py`

| Function | Metric | Description |
|---|---|---|
| `descriptive_accuracy(predict_fn, X_test, importance_list, top_k)` | Fidelity (DA) | Zeroes out top-k features per sample, measures anomaly probability drop |
| `mass_around_zero(importance, interval_size)` | Sparsity (MAZ) | Fraction of features with normalised importance < threshold |
| `maz_curve(importance, n_points)` | MAZ curve | MAZ at 20 threshold levels for plotting |
| `stability_score(importance_runs, top_k)` | Stability | Average pairwise Jaccard similarity of top-k feature sets across bootstrap runs |
| `confidence_calibration(bundles)` | Calibration | Pearson(confidence, stability); mean stability per tier |

### `src/visualize.py`

Generates 8 matplotlib figures saved to `results/`:

| Plot | File |
|------|------|
| Feature importance bar chart (single attack) | `01_feature_importance_single.png` |
| Confidence distribution + tier pie chart | `02_confidence_distribution.png` |
| Feature importance + uncertainty (hard sample) | `03a_hard_sample_uncertainty.png` |
| Feature importance + uncertainty (clear attack) | `03b_clear_sample_uncertainty.png` |
| Scatter: confidence vs actual stability (r = 0.83) | `04_confidence_vs_stability.png` |
| MAZ sparsity curves (CA-xNIDS vs xNIDS vs LIME vs SHAP) | `05_sparsity_maz_curves.png` |
| Stability comparison bar chart | `06_stability_comparison.png` |
| Defence rule count by confidence tier | `07_rule_quality_comparison.png` |
| Full evaluation dashboard (all metrics) | `08_dashboard.png` |

---

## Backend API Reference

The FastAPI backend runs on `http://localhost:8000`.

### REST Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Liveness check: `{"ok": true}` |
| GET | `/api/status` | — | Pipeline status, sim running state, active mode |
| POST | `/api/control` | `{"action": "start" \| "stop"}` | Start or stop the traffic simulation |
| POST | `/api/mode` | `{"mode": "xnids" \| "ca_xnids"}` | Switch detection/explanation mode |
| POST | `/api/inject` | `{"type": "normal" \| "attack", "count": int, "attack_type": str?}` | Queue manual packet injection |

### WebSocket

`ws://localhost:8000/ws` — streams JSON events in real time.

**Status event** (while pipeline loads or sim is stopped):
```json
{"type": "status", "status": "loading_model" | "training" | "stopped" | "ready"}
```

**Packet event** (normal packet during monitoring):
```json
{
  "type": "packet",
  "packet_id": 142,
  "timestamp": "2024-01-01T12:00:00Z",
  "prob": 0.12,
  "is_attack": false,
  "source": "auto"
}
```

**Attack event** (anomaly detected — includes full explanation):
```json
{
  "type": "attack",
  "packet_id": 167,
  "timestamp": "2024-01-01T12:00:42Z",
  "prob": 0.94,
  "is_attack": true,
  "attack_type": "DoS",
  "source": "auto",
  "explanation_mode": "ca_xnids",

  "features": [
    {"name": "dst_bytes", "importance": 0.82, "std": 0.04, "group": "basic"},
    {"name": "count",     "importance": 0.71, "std": 0.09, "group": "time_traffic"},
    ...
  ],
  "group_importance": {"basic": 0.61, "time_traffic": 0.28, "content": 0.08, "host_traffic": 0.03},

  "confidence": 0.83,
  "tier": "HIGH",
  "iptables_rule": "iptables -A INPUT -p tcp --dport 0:65535 -m comment --comment 'dst_bytes=...' -j DROP",
  "openflow_rule": "<nw_src=dst_bytes=..., actions=drop, priority=1, hard_timeout=600>",
  "scope": "per-flow",
  "review_required": false
}
```

In **xNIDS mode**, `confidence` is `null`, `tier` is always `"HIGH"`, `std` is `0.0` on all features, and `review_required` is `false`.

---

## Evaluation Metrics

### Fidelity — Descriptive Accuracy (DA)

Measures how faithfully the explanation identifies the features that drove the detection. For each sample, the top-k features identified by the explanation are zeroed out, and the anomaly probability drop is measured. A large drop means the explanation correctly pinpointed the attack-driving features.

### Sparsity — Mass Around Zero (MAZ)

Fraction of features whose normalised importance is below a threshold (default 0.1). Higher = sparser = explanation points to fewer, more specific features. The MAZ curve plots this at 20 threshold levels.

### Stability — Jaccard Similarity

Average pairwise Jaccard similarity of the top-k feature sets across N bootstrap runs. Measures how consistently the explanation identifies the same features when re-run with different random seeds.

### Calibration — Pearson r (Our Metric)

Pearson correlation between the CA-xNIDS confidence score and actual Jaccard stability across all 60 samples. r = 0.83 means the confidence score is a reliable predictor of explanation stability — high confidence really does mean a stable explanation.

---

## Key Results

| Metric | Value |
|--------|-------|
| DL-NIDS ROC-AUC | 1.000 |
| Mean Fidelity (DA) | 0.489 |
| Mean Sparsity (MAZ, t=0.1) | varies by run |
| Mean Stability (Jaccard, top-5) | 0.362 |
| Confidence–Stability Pearson r | **0.825** |
| Clear attacks — mean confidence | **0.709** |
| Hard/boundary samples — mean confidence | **0.091** |
| Δ confidence (clear − hard) | **0.619** |

The large gap in mean confidence between clear attacks (0.71) and boundary/evasion samples (0.09) shows that CA-xNIDS correctly distinguishes trustworthy explanations from unreliable ones — exactly the discrimination needed to safely gate auto-deployment of defence rules.

---

## Output Plots

All saved to `results/` by `python -m src.main`.

| File | Description |
|------|-------------|
| `01_feature_importance_single.png` | Feature importance for a single clear attack (xNIDS baseline) |
| `02_confidence_distribution.png` | Histogram of confidence scores across 60 samples + tier pie chart |
| `03a_hard_sample_uncertainty.png` | Feature importance bars with bootstrap uncertainty (hard/evasion sample) |
| `03b_clear_sample_uncertainty.png` | Feature importance bars with bootstrap uncertainty (clear attack) |
| `04_confidence_vs_stability.png` | Scatter plot: CA-xNIDS confidence vs actual Jaccard stability (r = 0.83) |
| `05_sparsity_maz_curves.png` | MAZ sparsity curves comparing CA-xNIDS, xNIDS, LIME, SHAP |
| `06_stability_comparison.png` | Bar chart of mean stability: CA-xNIDS vs xNIDS vs LIME vs SHAP |
| `07_rule_quality_comparison.png` | Count of rules per tier (auto-deploy, needs review, manual only) |
| `08_dashboard.png` | Full evaluation dashboard summarising all metrics |

---

## Team

IIT Jodhpur — CSL6010 Cybersecurity, M.Tech AI
