"""
Defence Rule Generator — converts xNIDS/CA-xNIDS explanations into
unified defence rules that can be translated to OpenFlow, iptables, etc.

Rule format (Sec 4 of paper):
    <entity, action, priority, timeout>
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass
from src.data_loader import FEATURE_NAMES, FEATURE_GROUPS


# ---------------------------------------------------------------------------
# Unified Defence Rule
# ---------------------------------------------------------------------------

@dataclass
class UnifiedDefenceRule:
    entity:          str
    action:          str
    priority:        int
    timeout:         int          # seconds; 0 = permanent
    scope:           str          # 'per-flow' | 'per-host' | 'multi-hosts'
    confidence:      float        # from CA-xNIDS confidence score
    confidence_tier: str          # 'HIGH' | 'MEDIUM' | 'LOW'
    top_features:    list[str]
    top_groups:      list[str]
    review_required: bool

    def to_iptables(self) -> str:
        if self.action == 'drop_flow':
            return (f"iptables -A INPUT -p tcp --dport 0:65535 "
                    f"-m comment --comment '{self.entity}' -j DROP")
        elif self.action == 'drop_host':
            return f"iptables -A INPUT -s {self.entity} -j DROP"
        return f"iptables -A INPUT -j LOG --log-prefix '{self.entity}: '"

    def to_openflow(self) -> str:
        if self.action == 'drop_flow':
            return (f"<nw_src={self.entity}, actions=drop, "
                    f"priority={self.priority}, hard_timeout={self.timeout}>")
        elif self.action == 'drop_host':
            return (f"<nw_src={self.entity}, actions=drop, "
                    f"priority={self.priority}, hard_timeout=0>")
        return f"<match={self.entity}, actions=output:controller>"

    def __str__(self):
        review = " *** REVIEW REQUIRED ***" if self.review_required else ""
        return (
            f"Rule(scope={self.scope}, action={self.action}, "
            f"priority={self.priority}, timeout={self.timeout}s, "
            f"conf={self.confidence:.2f}[{self.confidence_tier}], "
            f"features={self.top_features[:3]}){review}"
        )


# ---------------------------------------------------------------------------
# Rule generator
# ---------------------------------------------------------------------------

class DefenceRuleGenerator:
    """
    Convert an explanation (feature importance vector) into a UnifiedDefenceRule.

    CA-xNIDS enhancement: the confidence score and tier gate whether the rule
    is auto-deployed or flagged for review.
    """

    def __init__(self, feature_names: list[str] = None,
                 feature_groups: dict = None,
                 n_top_features: int = 5,
                 timeout_default: int = 600):
        self.feature_names   = feature_names or FEATURE_NAMES
        self.feature_groups  = feature_groups or FEATURE_GROUPS
        self.n_top_features  = n_top_features
        self.timeout_default = timeout_default
        self._priority_counter = 1

    # ------------------------------------------------------------------
    def generate(self,
                 importance: np.ndarray,
                 group_importance: dict,
                 X_current: np.ndarray,
                 confidence: float = 1.0,
                 confidence_tier: str = 'HIGH',
                 block_strategy: str = 'assertive') -> UnifiedDefenceRule:
        """
        Parameters
        ----------
        importance       : per-feature importance scores (n_features,)
        group_importance : dict group_name -> mean score
        X_current        : the actual feature values of the current sample
        confidence       : CA-xNIDS confidence score
        confidence_tier  : 'HIGH' | 'MEDIUM' | 'LOW'
        block_strategy   : 'passive' | 'assertive' | 'aggressive'
        """
        top_idx      = np.argsort(importance)[-self.n_top_features:][::-1]
        top_features = [self.feature_names[i] for i in top_idx if importance[i] > 0]
        top_groups   = sorted(group_importance, key=group_importance.get, reverse=True)[:2]

        scope  = self._determine_scope(group_importance)
        action = self._determine_action(scope, block_strategy)

        # Build entity string from top features
        entity_parts = []
        for i in top_idx[:3]:
            if importance[i] > 0:
                entity_parts.append(f"{self.feature_names[i]}={X_current[i]:.2f}")
        entity = "; ".join(entity_parts) if entity_parts else "anomalous_flow"

        # CA-xNIDS: mark low/medium confidence rules for review
        review_required = confidence_tier in ('LOW', 'MEDIUM')

        rule = UnifiedDefenceRule(
            entity          = entity,
            action          = action,
            priority        = self._priority_counter,
            timeout         = 0 if block_strategy == 'aggressive' else self.timeout_default,
            scope           = scope,
            confidence      = confidence,
            confidence_tier = confidence_tier,
            top_features    = top_features,
            top_groups      = top_groups,
            review_required = review_required,
        )
        self._priority_counter += 1
        return rule

    # ------------------------------------------------------------------
    def _determine_scope(self, group_importance: dict) -> str:
        dominant = max(group_importance, key=group_importance.get)
        if dominant == 'host_traffic':
            # Check if multi-host pattern
            if group_importance.get('time_traffic', 0) > 0.3:
                return 'multi-hosts'
            return 'per-host'
        return 'per-flow'

    def _determine_action(self, scope: str, strategy: str) -> str:
        if strategy == 'passive':
            return 'drop_flow'
        if strategy == 'aggressive':
            return 'drop_host'
        # assertive — default from paper
        return 'drop_host' if scope == 'per-host' else 'drop_flow'


# ---------------------------------------------------------------------------
# Batch rule generation with confidence gating (CA-xNIDS)
# ---------------------------------------------------------------------------

def generate_rules_batch(bundles, X_flat: np.ndarray,
                         history_len: int,
                         block_strategy: str = 'assertive',
                         auto_deploy_tier: str = 'HIGH') -> dict:
    """
    Generate defence rules for all samples and categorise by action tier.

    Returns
    -------
    dict with keys 'auto_deploy', 'needs_review', 'manual_only'
    """
    gen = DefenceRuleGenerator()
    results = {'auto_deploy': [], 'needs_review': [], 'manual_only': []}

    for k, bundle in enumerate(bundles):
        i = k + history_len
        if i >= len(X_flat):
            break
        rule = gen.generate(
            importance      = bundle.mean_importance,
            group_importance= bundle.group_importance,
            X_current       = X_flat[i],
            confidence      = bundle.confidence_score,
            confidence_tier = bundle.confidence_tier,
            block_strategy  = block_strategy,
        )
        if bundle.confidence_tier == 'HIGH':
            results['auto_deploy'].append(rule)
        elif bundle.confidence_tier == 'MEDIUM':
            results['needs_review'].append(rule)
        else:
            results['manual_only'].append(rule)

    return results
