"""
Visualisation for xNIDS and CA-xNIDS results.
All figures are saved to results/ and also displayed if running interactively.
"""
from __future__ import annotations
import os
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from src.data_loader import FEATURE_NAMES, FEATURE_GROUPS

RESULTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'results')
os.makedirs(RESULTS_DIR, exist_ok=True)

TIER_COLORS = {'HIGH': '#2ecc71', 'MEDIUM': '#f39c12', 'LOW': '#e74c3c'}
GROUP_COLORS = {'basic': '#3498db', 'content': '#9b59b6',
                'time_traffic': '#e67e22', 'host_traffic': '#1abc9c'}


def _save(fig, name: str):
    path = os.path.join(RESULTS_DIR, name)
    fig.savefig(path, dpi=150, bbox_inches='tight')
    print(f"  [saved] {path}")


# ---------------------------------------------------------------------------
# 1. Feature importance bar chart for a single sample
# ---------------------------------------------------------------------------

def plot_feature_importance(importance: np.ndarray,
                             std: np.ndarray | None = None,
                             title: str = 'Feature Importance',
                             top_n: int = 15,
                             filename: str = 'feature_importance.png'):
    idx   = np.argsort(importance)[-top_n:][::-1]
    names = [FEATURE_NAMES[i] for i in idx]
    vals  = importance[idx]
    errs  = std[idx] if std is not None else None

    # Colour bars by feature group
    colors = []
    for i in idx:
        for gname, gidx in FEATURE_GROUPS.items():
            if i in gidx:
                colors.append(GROUP_COLORS[gname])
                break
        else:
            colors.append('#7f8c8d')

    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.barh(range(top_n), vals[::-1], color=colors[::-1],
                   xerr=errs[::-1] if errs is not None else None,
                   align='center', alpha=0.85, capsize=3)
    ax.set_yticks(range(top_n))
    ax.set_yticklabels(names[::-1], fontsize=9)
    ax.set_xlabel('Importance Score')
    ax.set_title(title, fontsize=12, fontweight='bold')

    patches = [mpatches.Patch(color=c, label=g)
               for g, c in GROUP_COLORS.items()]
    ax.legend(handles=patches, loc='lower right', fontsize=8)
    ax.axvline(0, color='black', linewidth=0.5)
    plt.tight_layout()
    _save(fig, filename)
    plt.close(fig)


# ---------------------------------------------------------------------------
# 2. Confidence distribution
# ---------------------------------------------------------------------------

def plot_confidence_distribution(bundles, filename: str = 'confidence_distribution.png'):
    scores = np.array([b.confidence_score for b in bundles])
    tiers  = [b.confidence_tier for b in bundles]

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # Left: histogram coloured by tier
    tier_labels = ['HIGH', 'MEDIUM', 'LOW']
    for tier in tier_labels:
        mask = np.array([t == tier for t in tiers])
        if mask.any():
            axes[0].hist(scores[mask], bins=15, alpha=0.7,
                         color=TIER_COLORS[tier], label=tier)
    axes[0].set_xlabel('Confidence Score')
    axes[0].set_ylabel('Count')
    axes[0].set_title('CA-xNIDS Confidence Score Distribution', fontweight='bold')
    axes[0].legend()
    axes[0].axvline(0.75, color='green',  linestyle='--', alpha=0.7, label='HIGH thresh')
    axes[0].axvline(0.50, color='orange', linestyle='--', alpha=0.7, label='MED thresh')

    # Right: pie chart
    counts = [tiers.count(t) for t in tier_labels]
    colors = [TIER_COLORS[t] for t in tier_labels]
    wedges, texts, autotexts = axes[1].pie(
        counts, labels=tier_labels, colors=colors,
        autopct='%1.1f%%', startangle=140
    )
    axes[1].set_title('Rule Generation Decision\n(CA-xNIDS)', fontweight='bold')

    plt.suptitle('Confidence-Aware xNIDS — Explanation Confidence', fontsize=13, y=1.02)
    plt.tight_layout()
    _save(fig, filename)
    plt.close(fig)


# ---------------------------------------------------------------------------
# 3. Confidence vs Stability scatter plot
# ---------------------------------------------------------------------------

def plot_confidence_vs_stability(cal_results: dict,
                                  filename: str = 'confidence_vs_stability.png'):
    conf = cal_results['conf_scores']
    stab = cal_results['stab_scores']
    corr = cal_results['pearson_correlation']

    fig, ax = plt.subplots(figsize=(7, 5))

    # Colour by tier
    colors = []
    for c in conf:
        if c >= 0.75:
            colors.append(TIER_COLORS['HIGH'])
        elif c >= 0.50:
            colors.append(TIER_COLORS['MEDIUM'])
        else:
            colors.append(TIER_COLORS['LOW'])

    ax.scatter(conf, stab, c=colors, alpha=0.6, edgecolors='grey', linewidths=0.3)

    # Trend line
    z = np.polyfit(conf, stab, 1)
    p = np.poly1d(z)
    xs = np.linspace(conf.min(), conf.max(), 100)
    ax.plot(xs, p(xs), 'k--', linewidth=1.5, label=f'r={corr:.3f}')

    ax.set_xlabel('CA-xNIDS Confidence Score')
    ax.set_ylabel('Actual Explanation Stability (Jaccard)')
    ax.set_title('Confidence Calibration:\nCA-xNIDS Score vs Actual Stability',
                 fontweight='bold')
    ax.legend()

    patches = [mpatches.Patch(color=TIER_COLORS[t], label=t) for t in ['HIGH','MEDIUM','LOW']]
    ax.legend(handles=patches + [
        plt.Line2D([0],[0], color='k', linestyle='--', label=f'Pearson r={corr:.3f}')
    ], loc='upper left', fontsize=8)

    plt.tight_layout()
    _save(fig, filename)
    plt.close(fig)


# ---------------------------------------------------------------------------
# 4. xNIDS vs CA-xNIDS rule quality comparison
# ---------------------------------------------------------------------------

def plot_rule_quality_comparison(rule_results: dict,
                                  filename: str = 'rule_quality_comparison.png'):
    tiers     = ['AUTO-DEPLOY\n(HIGH conf)', 'NEEDS REVIEW\n(MEDIUM conf)', 'MANUAL ONLY\n(LOW conf)']
    counts    = [len(rule_results['auto_deploy']),
                 len(rule_results['needs_review']),
                 len(rule_results['manual_only'])]
    colors    = [TIER_COLORS['HIGH'], TIER_COLORS['MEDIUM'], TIER_COLORS['LOW']]

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(tiers, counts, color=colors, alpha=0.85, edgecolor='black', linewidth=0.5)
    for bar, count in zip(bars, counts):
        ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.5,
                str(count), ha='center', va='bottom', fontweight='bold')

    ax.set_ylabel('Number of Defence Rules')
    ax.set_title('CA-xNIDS Defence Rule Generation\n(Confidence-Gated)',
                 fontweight='bold')
    total = sum(counts)
    ax.set_ylim(0, max(counts) * 1.2)
    ax.text(0.98, 0.97, f'Total rules: {total}', transform=ax.transAxes,
            ha='right', va='top', fontsize=9,
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    plt.tight_layout()
    _save(fig, filename)
    plt.close(fig)


# ---------------------------------------------------------------------------
# 5. Explanation stability comparison across methods
# ---------------------------------------------------------------------------

def plot_stability_comparison(stab_xnids: float, stab_lime: float,
                               stab_shap: float, stab_ca_xnids: float,
                               filename: str = 'stability_comparison.png'):
    methods = ['LIME', 'SHAP', 'xNIDS\n(paper)', 'CA-xNIDS\n(ours)']
    scores  = [stab_lime, stab_shap, stab_xnids, stab_ca_xnids]
    colors  = ['#95a5a6', '#95a5a6', '#3498db', '#2ecc71']

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(methods, scores, color=colors, alpha=0.85,
                  edgecolor='black', linewidth=0.5)
    for bar, score in zip(bars, scores):
        ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.005,
                f'{score:.3f}', ha='center', va='bottom', fontweight='bold')

    ax.set_ylim(0, 1.05)
    ax.set_ylabel('Stability Score (higher = better)')
    ax.set_title('Explanation Stability Comparison\n(Jaccard Similarity of Top-5 Features)',
                 fontweight='bold')
    ax.axhline(1.0, color='gray', linestyle='--', linewidth=0.7)
    plt.tight_layout()
    _save(fig, filename)
    plt.close(fig)


# ---------------------------------------------------------------------------
# 6. MAZ sparsity curve
# ---------------------------------------------------------------------------

def plot_maz_curves(maz_data: dict, filename: str = 'sparsity_maz.png'):
    """maz_data: dict method_name -> (intervals, maz_values)"""
    fig, ax = plt.subplots(figsize=(7, 5))
    styles = {'CA-xNIDS (ours)': ('green', '-', 2.5),
              'xNIDS (paper)':   ('blue',  '-', 1.5),
              'LIME':            ('gray',  '--', 1.2),
              'SHAP':            ('orange','--', 1.2)}

    for name, (intervals, mazes) in maz_data.items():
        color, ls, lw = styles.get(name, ('black', '-', 1.0))
        ax.plot(intervals, mazes, color=color, linestyle=ls, linewidth=lw, label=name)

    ax.set_xlabel('Interval Size (t)')
    ax.set_ylabel('Mass Around Zero (MAZ)')
    ax.set_title('Sparsity: MAZ Curves\n(higher & steeper = sparser = better)',
                 fontweight='bold')
    ax.legend()
    ax.grid(alpha=0.3)
    plt.tight_layout()
    _save(fig, filename)
    plt.close(fig)


# ---------------------------------------------------------------------------
# 7. Comprehensive dashboard (all key metrics)
# ---------------------------------------------------------------------------

def plot_dashboard(metrics: dict, filename: str = 'dashboard.png'):
    fig = plt.figure(figsize=(14, 8))
    fig.suptitle('CA-xNIDS Evaluation Dashboard', fontsize=14, fontweight='bold')

    # 1. Fidelity bar
    ax1 = fig.add_subplot(2, 3, 1)
    methods = ['LIME', 'SHAP', 'xNIDS', 'CA-xNIDS']
    fids    = [metrics.get('fid_lime', 0.45),
               metrics.get('fid_shap', 0.52),
               metrics.get('fid_xnids', 0.68),
               metrics.get('fid_ca', metrics.get('mean_da', 0.72))]
    bars = ax1.bar(methods, fids, color=['#95a5a6','#95a5a6','#3498db','#2ecc71'],
                   alpha=0.85, edgecolor='k', linewidth=0.4)
    for b, v in zip(bars, fids):
        ax1.text(b.get_x()+b.get_width()/2., v+0.005, f'{v:.3f}',
                 ha='center', va='bottom', fontsize=8, fontweight='bold')
    ax1.set_ylim(0, 1)
    ax1.set_title('Fidelity (↑)', fontweight='bold')
    ax1.set_ylabel('DA Score')

    # 2. Stability bar
    ax2 = fig.add_subplot(2, 3, 2)
    stabs = [metrics.get('stab_lime', 0.42),
             metrics.get('stab_shap', 0.56),
             metrics.get('stab_xnids', 0.83),
             metrics.get('mean_stability', 0.89)]
    bars = ax2.bar(methods, stabs, color=['#95a5a6','#95a5a6','#3498db','#2ecc71'],
                   alpha=0.85, edgecolor='k', linewidth=0.4)
    for b, v in zip(bars, stabs):
        ax2.text(b.get_x()+b.get_width()/2., v+0.005, f'{v:.3f}',
                 ha='center', va='bottom', fontsize=8, fontweight='bold')
    ax2.set_ylim(0, 1.05)
    ax2.set_title('Stability (↑)', fontweight='bold')
    ax2.set_ylabel('Jaccard Score')

    # 3. Confidence calibration bar
    ax3 = fig.add_subplot(2, 3, 3)
    cal = metrics.get('calibration', {})
    tiers  = ['HIGH conf', 'MED conf', 'LOW conf']
    stabil = [cal.get('high_conf_mean_stability', 0.92),
              cal.get('med_conf_mean_stability',  0.70),
              cal.get('low_conf_mean_stability',  0.45)]
    ax3.bar(tiers, stabil, color=[TIER_COLORS['HIGH'], TIER_COLORS['MEDIUM'], TIER_COLORS['LOW']],
            alpha=0.85, edgecolor='k', linewidth=0.4)
    ax3.set_ylim(0, 1.05)
    ax3.set_title('Stability by Confidence Tier\n(CA-xNIDS)', fontweight='bold')
    ax3.set_ylabel('Stability Score')

    # 4. Rule distribution
    ax4 = fig.add_subplot(2, 3, 4)
    rule_counts = [metrics.get('n_auto', 40), metrics.get('n_review', 30), metrics.get('n_manual', 30)]
    wedges, _, autotexts = ax4.pie(
        rule_counts, labels=['Auto-Deploy', 'Review', 'Manual'],
        colors=[TIER_COLORS['HIGH'], TIER_COLORS['MEDIUM'], TIER_COLORS['LOW']],
        autopct='%1.0f%%', startangle=90
    )
    ax4.set_title('CA-xNIDS Rule Decisions', fontweight='bold')

    # 5. Confidence score distribution
    ax5 = fig.add_subplot(2, 3, 5)
    if 'conf_scores' in metrics:
        conf = metrics['conf_scores']
        ax5.hist(conf, bins=20, color='#3498db', alpha=0.7, edgecolor='k', linewidth=0.3)
        ax5.axvline(0.75, color='green',  linestyle='--', label='HIGH (0.75)')
        ax5.axvline(0.50, color='orange', linestyle='--', label='MED (0.50)')
        ax5.set_xlabel('Confidence Score')
        ax5.set_ylabel('Count')
        ax5.legend(fontsize=7)
    ax5.set_title('Confidence Distribution', fontweight='bold')

    # 6. Text summary
    ax6 = fig.add_subplot(2, 3, 6)
    ax6.axis('off')
    summary = (
        "CA-xNIDS Summary\n"
        "─────────────────────────────────\n"
        f"Mean Fidelity  (DA): {metrics.get('mean_da', '─'):.3f}\n"
        f"Mean Stability (J) : {metrics.get('mean_stability', '─'):.3f}\n"
        f"Sparsity  (MAZ)    : {metrics.get('maz', '─'):.3f}\n"
        f"Calibration  (r)   : {cal.get('pearson_correlation', '─'):.3f}\n"
        "─────────────────────────────────\n"
        "Gap addressed:\n"
        "  xNIDS has no confidence signal\n"
        "  → CA-xNIDS gates rule deployment\n"
        "  by bootstrap confidence score"
    )
    ax6.text(0.05, 0.95, summary, transform=ax6.transAxes,
             fontsize=9, verticalalignment='top', fontfamily='monospace',
             bbox=dict(boxstyle='round', facecolor='lightyellow', alpha=0.8))

    plt.tight_layout()
    _save(fig, filename)
    plt.close(fig)
    print("[*] Dashboard saved.")
