# SmartFin AI — Financial Anomaly Detection Subsystem

**Document Version:** 1.0.0  
**Status:** Production Ready  
**Component:** Personal Finance Behavioral Outlier & Pattern Intelligence

---

> [!IMPORTANT]
> **Safety and Non-Fraud Disclaimer:**  
> An anomaly indicates an unusual spending pattern relative to a user's personal historical behavior. It represents a statistical deviation and **does not establish fraud, scam, or unauthorized compromise**. The system strictly avoids all fraud claims unless validated by a separate verified fraud detection engine.

---

## 1. Purpose & Objective

The **Financial Anomaly Detection** subsystem identifies atypical expenditures, unusual merchant interactions, category spending spikes, and high-frequency bursts within an authenticated user's transaction stream.

### Primary Goals:
1. **Personalization**: Learn the user's individual spending rhythm rather than comparing them to a global average.
2. **Interpretability & Transparency**: Provide human-understandable explanations and transparent contributing feature signals (e.g., "Amount of $4,500 is significantly higher than your typical Food median of $65").
3. **Multi-Model Ensembling**: Combine robust statistical baselines (Median + Median Absolute Deviation) with unsupervised machine learning (scikit-learn Isolation Forest).
4. **User-in-the-Loop Feedback**: Allow users to review and label anomalies (`EXPECTED`, `UNUSUAL`, `DISMISSED`) to curate labeled datasets for adaptive model calibration.
5. **Strict Temporal Causality**: Zero future information leaks into historical baselines.
6. **No Fabricated Data**: If transaction history is insufficient ($< 5$ transactions), the system returns an explicit `insufficient_data` status rather than manufacturing synthetic anomaly scores.

---

## 2. High-Level Architecture & End-to-End Data Flow

```
[ Authenticated User / React Dashboard (/anomalies) ]
                     │
                     ▼ (JWT Bearer Token)
[ Express API Gateway (Node.js) ]
   ├── Authentication & User Isolation Guard (req.user.userId)
   ├── MongoDB Transaction Query (Filter deleted, sort chronologically)
   ├── Data Sanitization (Excludes transfers, validates positive amounts, dedupes)
                     │
                     ▼ (Service-to-Service Secret Token)
[ FastAPI ML Anomaly Detection Microservice (Python 3.10) ]
   ├── Data Sufficiency Validation (Min 5 transactions)
   ├── Temporal Feature Extractor (Causal running accumulators, 0 future leakage)
   │    ├── user_amount_deviation (Modified Z-score via MAD)
   │    ├── category_amount_deviation (Category median & MAD)
   │    ├── merchant_amount_deviation (Merchant median & MAD)
   │    ├── merchant_frequency (Historical transaction count at merchant)
   │    ├── recent_3d_tx_count & recent_3d_merchant_count (Burst detection)
   │    └── days_since_last_tx
   ├── Statistical Baseline Detector (Modified Z-score thresholds)
   ├── Isolation Forest Tree Ensemble (Multivariate outlier isolation)
   ├── Signal Ensembler & Score Normalization ([0.0, 1.0])
   ├── Explainability Generator (Top contributing signals & plain-language reason)
   └── Severity Classification (HIGH >= 0.85, MEDIUM >= 0.70, LOW >= 0.55)
                     │
                     ▼
[ Express API Gateway ]
   ├── Idempotent Upsert (FinancialAnomaly Mongoose model with compound unique index)
   ├── Deduplicated Notification Dispatch (NotificationType.ANOMALY_DETECTED, max 3/batch)
   └── JSON Response Envelope
                     │
                     ▼
[ React Frontend (/anomalies & /transactions) ]
   ├── AnomalySummaryCards (New, Confirmed Unusual, Expected, Dismissed, Total)
   ├── Filter Bar (Status, Severity, Anomaly Type, Search)
   ├── Interactive AnomalyTable (With unusualness meters & accessible badges)
   ├── AnomalyDetailDrawer (Signal breakdown & Feedback: Expected / Unusual / Dismiss)
   └── Transaction Ledger Highlight (Visual warning badge & amber row accent)
```

---

## 3. Data Sources & Transaction Schema

The anomaly engine uses existing transaction records from the authenticated user:
- `id`: Transaction MongoDB ObjectId
- `date`: ISO 8601 timestamp
- `amount`: Strictly positive numeric value
- `currency`: 3-letter currency code (e.g., USD, INR)
- `merchant`: Cleaned merchant identifier
- `category`: Category name or slug
- `type`: `EXPENSE`, `INCOME`, or `TRANSFER`
- `isRecurring`: Flag indicating known recurring obligation

---

## 4. Preprocessing & Data Cleaning Rules

Before feature extraction or model inference, transactions undergo deterministic cleaning:
1. **Transfer Exclusion**: Transactions with `type === 'TRANSFER'` are excluded to prevent legitimate account balancing from appearing as spending spikes.
2. **Non-Positive Value Filter**: Transactions with `amount <= 0` or missing timestamps are excluded.
3. **Deduplication**: Transactions sharing identical date, amount, and normalized merchant name are filtered out to avoid double counting.
4. **Chronological Sorting**: Transactions are ordered strictly by timestamp ($t_0 \le t_1 \le \dots \le t_n$).

---

## 5. Statistical Baseline (Median + MAD)

Financial transaction amounts exhibit high skewness and fat-tailed distributions, making standard Mean and Standard Deviation sensitive to outliers. The statistical baseline uses **Median** and **Median Absolute Deviation (MAD)**:

$$\text{MAD} = \text{median}(|x_i - \text{median}(X)|)$$

The robust Modified Z-score is computed as:

$$M_z = \frac{0.6745 \cdot |x - \text{median}|}{\text{MAD} + \epsilon}$$

Where $\epsilon = 10^{-4}$ handles zero variance.

### Baseline Anomaly Triggers:
- **`AMOUNT_ANOMALY`**: $M_z \ge 2.5$ against overall user transaction history.
- **`CATEGORY_ANOMALY`**: $M_z \ge 2.5$ against category-specific history ($\ge 2$ prior records).
- **`MERCHANT_ANOMALY`**: $M_z \ge 2.5$ against merchant-specific history ($\ge 2$ prior records).
- **`FREQUENCY_ANOMALY`**: $\ge 4$ transactions at the same merchant within a 3-day sliding window.

---

## 6. Isolation Forest Machine Learning

For complex, multivariate anomalies (e.g. an amount that is moderate individually but anomalous given the merchant and day-of-week timing), the system trains a scikit-learn `IsolationForest`:
- `n_estimators`: 100
- `contamination`: 0.05 (calibrated to flag approximately 5% of extreme pattern variations)
- `random_state`: 42 (ensures deterministic, reproducible scoring)
- `max_samples`: "auto"

### Score Normalization:
Isolation Forest raw decision scores are mapped to a normalized range $[0.0, 1.0]$ using a sigmoid transformation:

$$\text{score} = \frac{1}{1 + \exp(\text{raw\_score} \cdot 8)}$$

Where values $\ge 0.55$ indicate unusual patterns.

---

## 7. Feature Engineering Pipeline

All features are calculated causally: for transaction $i$, statistics only utilize historical transactions $0 \dots i-1$:

| Feature | Type | Description |
|---|---|---|
| `amount` | Float | Raw transaction amount |
| `log_amount` | Float | $\log(1 + \text{amount})$ |
| `user_amount_deviation` | Float | Modified Z-score against overall user median and MAD |
| `category_amount_deviation` | Float | Modified Z-score against category median and MAD |
| `merchant_amount_deviation` | Float | Modified Z-score against merchant median and MAD |
| `merchant_frequency` | Int | Total prior transactions at this merchant |
| `recent_3d_tx_count` | Int | User transactions within 3-day causal window |
| `recent_3d_merchant_count` | Int | Transactions at this merchant within 3-day causal window |
| `days_since_last_tx` | Float | Elapsed days since preceding transaction |

---

## 8. Temporal Leakage Prevention

To guarantee zero future information leakage:
1. Transactions are sorted chronologically.
2. Running history accumulators (`history_amounts`, `history_by_category`, `history_by_merchant`, `past_dates`) are queried to compute baseline medians for transaction $i$.
3. Transaction $i$ is only appended to the accumulators **after** its features and scores have been fully evaluated.

---

## 9. Explainability Layer

Rather than presenting black-box scores, each anomaly includes:
1. **Human-Readable Reason**: A plain-language summary (e.g., *"Amount of $4,500.00 is significantly above your typical Food & Dining spending pattern."*).
2. **Contributing Signals**: Top deviating features with human-readable descriptions, calculated values, and impact levels (`high`, `medium`, `low`).
3. **Zero Fraud Terminology**: Language is strictly neutral, describing statistical deviations without accusatory or alarmist phrases.

---

## 10. Thresholds & Severity Configuration

| Severity | Normalized Score Range | Visual Presentation | Notification Priority |
|---|---|---|---|
| **HIGH** | $0.85 \le \text{score} \le 1.00$ | Rose badge (`#f43f5e`), dark rose background | `NotificationPriority.HIGH` |
| **MEDIUM** | $0.70 \le \text{score} < 0.85$ | Amber badge (`#f59e0b`), dark amber background | `NotificationPriority.MEDIUM` |
| **LOW** | $0.55 \le \text{score} < 0.70$ | Sky badge (`#0ea5e9`), dark sky background | None (in-dashboard only) |

---

## 11. User Feedback Loop

Users can record feedback on any flagged transaction:
- **`EXPECTED`**: "This was expected" (e.g. planned holiday dinner or annual subscription). Transitions status to `REVIEWED`.
- **`UNUSUAL`**: "This was unusual" (User confirms pattern deviation). Transitions status to `CONFIRMED_UNUSUAL`.
- **`DISMISSED`**: User dismisses notification without action. Transitions status to `DISMISSED`.

Feedback records include timestamp and optional user notes, forming an auditable dataset for future supervised classification and personalized threshold tuning.

---

## 12. Idempotency & Persistence

- **Compound Unique Index**: `{ userId: 1, transactionId: 1 }` guarantees that scanning the same transactions repeatedly will never create duplicate anomaly entries.
- **Score Updates**: If a transaction is re-evaluated, model scores and contributing signals are updated in-place while preserving existing user feedback and review status.

---

## 13. REST APIs

### FastAPI Microservice:
- `POST /api/v1/anomalies/detect`: Evaluates transaction stream.
- `GET /api/v1/anomalies/info`: Returns detector metadata and threshold configuration.

### Express Node API Gateway:
- `POST /api/v1/anomalies/detect`: Triggers anomaly scan for authenticated user.
- `GET /api/v1/anomalies`: Lists paginated anomalies with filtering.
- `GET /api/v1/anomalies/summary`: Returns aggregate statistics by status and severity.
- `GET /api/v1/anomalies/:id`: Retrieves single anomaly details (IDOR protected).
- `PATCH /api/v1/anomalies/:id/status`: Updates anomaly review status.
- `POST /api/v1/anomalies/:id/feedback`: Records user feedback.

---

## 14. Notifications Integration & Deduplication

- Integrates with `NotificationType.ANOMALY_DETECTED`.
- Automatically dispatches notifications only for newly flagged `HIGH` and `MEDIUM` anomalies.
- Caps batch notifications to a maximum of 3 per scan to prevent notification storms.
- Tracks `notified: boolean` on each anomaly record to prevent duplicate alerts.

---

## 15. Security & User Data Isolation

- **Authentication Guard**: All endpoints require a valid JWT bearer token.
- **Resource Ownership**: Every database query enforces `{ userId: new Types.ObjectId(req.user.userId) }`.
- **IDOR Protection**: Requests for individual anomaly records or status updates verify that the record belongs to the calling user, returning `404 Not Found` on cross-user attempts.
- **Service-to-Service Security**: FastAPI microservice communication uses shared secret authorization tokens.

---

## 16. Verification & Test Summary

- **FastAPI Pytest Suite (`test_financial_anomalies.py`)**: 9/9 passed.
  - Data cleaning & transfer exclusion
  - Temporal causality and zero look-ahead leakage
  - Robust Modified Z-score calculation
  - Cold-start handling ($< 5$ transactions)
  - Amount, category, merchant, and burst frequency detection
  - Isolation Forest fitting and score normalization
  - FastAPI endpoint contracts and non-fraud disclaimer verification
- **Node Vitest Integration Suite (`anomaly.test.ts`)**: 11/11 passed.
  - 401 unauthenticated rejection
  - User A listing and summary isolation
  - User B data isolation (User A records hidden)
  - IDOR access prevention (404)
  - Cross-user status update and feedback prevention (404)
  - Status updates and feedback recording
  - Compound unique index duplicate prevention
  - Absence of fraud terminology
- **Frontend Build (`npm run build`)**: 0 errors, successful production bundle.
