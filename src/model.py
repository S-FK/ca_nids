"""
LSTM-based Deep Learning Network Intrusion Detection System (DL-NIDS).
Mirrors the RNN-IDS / ODDS architecture described in the xNIDS paper.
"""
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import classification_report, roc_auc_score


class LSTMDetector(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 64,
                 num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size, hidden_size, num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        return self.classifier(out[:, -1, :]).squeeze(-1)


class DLNIDSTrainer:
    def __init__(self, input_size: int, hidden_size: int = 64,
                 num_layers: int = 2, dropout: float = 0.2,
                 lr: float = 1e-3, device: str | None = None):
        self.device = device or ('cuda' if torch.cuda.is_available() else
                                  'mps' if torch.backends.mps.is_available() else 'cpu')
        self.model = LSTMDetector(input_size, hidden_size, num_layers, dropout).to(self.device)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        self.criterion = nn.BCELoss()
        print(f"[*] DL-NIDS on device: {self.device}")

    # ------------------------------------------------------------------
    def train(self, X_seq: np.ndarray, y: np.ndarray,
              epochs: int = 15, batch_size: int = 512, verbose: bool = True):
        dataset = TensorDataset(
            torch.tensor(X_seq, dtype=torch.float32),
            torch.tensor(y, dtype=torch.float32)
        )
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        self.model.train()
        for epoch in range(1, epochs + 1):
            total_loss, correct, total = 0.0, 0, 0
            for xb, yb in loader:
                xb, yb = xb.to(self.device), yb.to(self.device)
                self.optimizer.zero_grad()
                preds = self.model(xb)
                loss = self.criterion(preds, yb)
                loss.backward()
                self.optimizer.step()
                total_loss += loss.item() * len(yb)
                correct += ((preds > 0.5) == yb.bool()).sum().item()
                total += len(yb)
            if verbose and (epoch % 5 == 0 or epoch == 1):
                acc = correct / total
                print(f"    Epoch {epoch:02d}/{epochs} | loss={total_loss/total:.4f} | acc={acc:.4f}")

    # ------------------------------------------------------------------
    def predict_proba(self, X_seq: np.ndarray, batch_size: int = 1024) -> np.ndarray:
        self.model.eval()
        probs = []
        with torch.no_grad():
            for i in range(0, len(X_seq), batch_size):
                xb = torch.tensor(X_seq[i:i+batch_size], dtype=torch.float32).to(self.device)
                probs.append(self.model(xb).cpu().numpy())
        return np.concatenate(probs)

    def predict(self, X_seq: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        return (self.predict_proba(X_seq) > threshold).astype(int)

    # ------------------------------------------------------------------
    def predict_single(self, x_seq: np.ndarray) -> float:
        """Predict anomaly probability for a single sequence (shape: seq_len x features)."""
        self.model.eval()
        with torch.no_grad():
            xb = torch.tensor(x_seq[None], dtype=torch.float32).to(self.device)
            return float(self.model(xb).cpu().item())

    # ------------------------------------------------------------------
    def evaluate(self, X_seq: np.ndarray, y_true: np.ndarray):
        y_pred = self.predict(X_seq)
        y_prob = self.predict_proba(X_seq)
        print("\n[*] DL-NIDS Evaluation:")
        print(classification_report(y_true, y_pred, target_names=['Normal', 'Attack']))
        auc = roc_auc_score(y_true, y_prob)
        print(f"    ROC-AUC: {auc:.4f}")
        return y_pred, y_prob

    # ------------------------------------------------------------------
    def make_explain_predict_fn(self, X_history: np.ndarray, seq_len: int = 6):
        """
        Return a predict function for the explainer that uses real history context.

        Each call builds proper sequences: [history_context | z_current]
        so the LSTM sees the correct temporal context.
        X_history: (history_len, n_features) — the preceding samples for this anomaly.
        """
        h = np.array(X_history, dtype=np.float32)
        need = seq_len - 1
        if len(h) < need:
            pad = np.zeros((need - len(h), h.shape[1]), dtype=np.float32)
            h = np.vstack([pad, h])
        h = h[-need:]   # keep only the most recent `need` rows

        def fn(X_flat: np.ndarray) -> np.ndarray:
            # X_flat: (n_samples, features)
            seqs = np.concatenate(
                [np.broadcast_to(h, (len(X_flat), *h.shape)),   # (n, need, feat)
                 X_flat[:, None, :]],                            # (n, 1,    feat)
                axis=1
            )   # → (n, seq_len, features)
            return self.predict_proba(seqs.astype(np.float32))
        return fn

    def save(self, path: str):
        torch.save(self.model.state_dict(), path)
        print(f"[*] Model saved to {path}")

    def load(self, path: str):
        self.model.load_state_dict(torch.load(path, map_location=self.device))
        print(f"[*] Model loaded from {path}")
