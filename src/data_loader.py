"""
Data loading and preprocessing for CA-xNIDS demonstration.
Uses KDD Cup 99 dataset — the standard NIDS benchmark.
"""
import numpy as np
import pandas as pd
from sklearn.datasets import fetch_kddcup99
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
import warnings
warnings.filterwarnings('ignore')

FEATURE_NAMES = [
    'duration', 'protocol_type', 'service', 'flag', 'src_bytes', 'dst_bytes',
    'land', 'wrong_fragment', 'urgent', 'hot', 'num_failed_logins', 'logged_in',
    'num_compromised', 'root_shell', 'su_attempted', 'num_root', 'num_file_creations',
    'num_shells', 'num_access_files', 'num_outbound_cmds', 'is_host_login',
    'is_guest_login', 'count', 'srv_count', 'serror_rate', 'srv_serror_rate',
    'rerror_rate', 'srv_rerror_rate', 'same_srv_rate', 'diff_srv_rate',
    'srv_diff_host_rate', 'dst_host_count', 'dst_host_srv_count',
    'dst_host_same_srv_rate', 'dst_host_diff_srv_rate', 'dst_host_same_src_port_rate',
    'dst_host_srv_diff_host_rate', 'dst_host_serror_rate', 'dst_host_srv_serror_rate',
    'dst_host_rerror_rate', 'dst_host_srv_rerror_rate'
]

# Domain-structured feature groups as defined in the xNIDS paper
FEATURE_GROUPS = {
    'basic':        list(range(0, 9)),
    'content':      list(range(9, 22)),
    'time_traffic': list(range(22, 31)),
    'host_traffic': list(range(31, 41)),
}

CATEGORICAL_INDICES = [1, 2, 3]   # protocol_type, service, flag

# Human-readable rule templates per feature group
RULE_TEMPLATES = {
    'basic': {
        'protocol_type': 'block traffic on protocol {val}',
        'service':       'block traffic targeting service {val}',
        'flag':          'block TCP connections with flag={val}',
        'src_bytes':     'rate-limit connections with src_bytes > {val:.0f}',
        'dst_bytes':     'rate-limit connections with dst_bytes > {val:.0f}',
        'default':       'restrict basic network flow parameters',
    },
    'content': {
        'num_failed_logins': 'block hosts with failed_logins > {val:.0f}',
        'root_shell':        'alert on root shell activity',
        'su_attempted':      'alert on su privilege escalation attempts',
        'default':           'monitor content-based anomalies',
    },
    'time_traffic': {
        'count':       'rate-limit hosts exceeding {val:.0f} connections/window',
        'serror_rate': 'block source if SYN error rate > {val:.2f}',
        'default':     'throttle time-window traffic anomalies',
    },
    'host_traffic': {
        'dst_host_count':        'block dst host with > {val:.0f} connections',
        'dst_host_serror_rate':  'block dst host SYN error rate > {val:.2f}',
        'default':               'restrict host-based traffic anomalies',
    },
}


class KDDDataLoader:
    def __init__(self, history_len: int = 5, test_size: float = 0.2,
                 random_state: int = 42, subset: str = 'SA'):
        self.history_len = history_len
        self.test_size = test_size
        self.random_state = random_state
        self.subset = subset
        self.scaler = StandardScaler()
        self.label_encoders: dict = {}
        self.n_features: int = 0

    # ------------------------------------------------------------------
    def load(self):
        print("[*] Loading KDD Cup 99 dataset (subset='SA') …")
        raw = fetch_kddcup99(subset=self.subset, shuffle=True,
                             random_state=self.random_state)
        df = pd.DataFrame(raw.data, columns=FEATURE_NAMES)

        for idx in CATEGORICAL_INDICES:
            col = FEATURE_NAMES[idx]
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            self.label_encoders[col] = le

        X = df.values.astype(np.float32)
        y = np.array(
            [0 if lbl == b'normal.' else 1 for lbl in raw.target],
            dtype=np.int64
        )

        X = self.scaler.fit_transform(X).astype(np.float32)
        self.n_features = X.shape[1]

        print(f"    {X.shape[0]:,} samples | {X.shape[1]} features | "
              f"{y.sum():,} attacks / {(y==0).sum():,} normal")

        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=self.test_size,
            random_state=self.random_state, stratify=y
        )

        X_tr_seq, y_tr_seq = self._make_sequences(X_tr, y_tr)
        X_te_seq, y_te_seq = self._make_sequences(X_te, y_te)

        return X_tr_seq, y_tr_seq, X_te_seq, y_te_seq, X_tr, X_te, y_tr, y_te

    # ------------------------------------------------------------------
    def _make_sequences(self, X: np.ndarray, y: np.ndarray):
        """Build overlapping windows of length (history_len + 1)."""
        seqs, labels = [], []
        for i in range(self.history_len, len(X)):
            seqs.append(X[i - self.history_len: i + 1])
            labels.append(y[i])
        return np.array(seqs, dtype=np.float32), np.array(labels, dtype=np.int64)
