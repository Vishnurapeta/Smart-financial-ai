"""
SmartFin AI — Recurring Expense & Subscription Pattern Detection Engine
Analyzes historical transactions using merchant similarity, amount variance,
time intervals, and transaction frequency to identify recurring patterns.
"""

from datetime import datetime, timedelta
import math
import re
from typing import Any, Dict, List, Optional, Tuple


SUBSCRIPTION_KEYWORDS = {
    "netflix", "spotify", "prime", "amazon prime", "youtube", "disney",
    "hotstar", "apple", "icloud", "google one", "google storage", "gym",
    "fitness", "patreon", "adobe", "github", "chatgpt", "openai", "dropbox",
    "medium", "nytimes", "playstation", "xbox", "zoom", "hulu", "canva",
    "notion", "figma", "audible", "sub", "membership", "crunchyroll",
    "jiocinema", "sonyliv", "zee5", "coursera", "udemy", "linkedin",
    "office 365", "microsoft 365", "copilot", "cursor", "perplexity",
}

EMI_KEYWORDS = {
    "emi", "loan", "bajaj", "finance", "credit card emi", "hdfc loan",
    "icici loan", "sbi loan", "auto loan", "car loan", "home loan",
    "personal loan", "mortgage", "financing", "installment", "capital",
}

UTILITY_KEYWORDS = {
    "electricity", "power", "bescom", "water", "broadband", "wifi", "fiber",
    "airtel", "jio", "vi ", "vodafone", "tata sky", "dish tv", "gas",
    "indane", "hp gas", "utility", "piped gas", "municipal", "electric",
    "dth", "recharge", "postpaid",
}

DISCRETIONARY_MERCHANTS = {
    "uber", "ola", "lyft", "rapido", "grab", "swiggy", "zomato", "zepto",
    "blinkit", "instamart", "dunzo", "amazon", "flipkart", "bigbasket",
    "starbucks", "mcdonalds", "mcdonald", "dominos", "kfc", "burger king",
    "subway", "pizza hut", "cinema", "movie", "pvr", "inox", "bookmyshow",
}

DISCRETIONARY_PASS_EXCEPTIONS = {
    "pass", "one", "plus", "membership", "sub", "pro", "gold", "prime"
}

NOISE_WORDS = {
    "pvt", "ltd", "inc", "llc", "corp", "pos", "upi", "autopay", "billdesk",
    "razorpay", "paytm", "ach", "direct debit", "sub", "bill", "payment",
    "card", "online", "tx", "txn", "ref", "in", "com", "co", "org", "net",
    "io", "app", "www",
}


def is_discretionary_merchant(raw_merchant: str, norm_merchant: str) -> bool:
    """Return True if merchant is variable discretionary spending (rides, food, movies)."""
    text = f"{raw_merchant} {norm_merchant}".lower()
    
    # Check if explicitly an allowed pass/membership exception
    for exc in DISCRETIONARY_PASS_EXCEPTIONS:
        if exc in text:
            return False
            
    for dm in DISCRETIONARY_MERCHANTS:
        if dm in text:
            return True
            
    return False


def normalize_merchant_name(name: str) -> str:
    """Normalize merchant names to cluster similar merchants together."""
    if not name:
        return "unknown"
    cleaned = name.lower()
    cleaned = re.sub(r"\.(com|in|org|net|co|io|ai|app)", " ", cleaned)
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    tokens = [t for t in cleaned.split() if t not in NOISE_WORDS and len(t) > 1]
    if not tokens:
        return cleaned.strip() or "unknown"
    # If the primary brand token is distinctive (>= 4 chars or known brand), return primary token
    if (
        len(tokens) > 1
        and len(tokens[0]) >= 4
        and (tokens[0] in SUBSCRIPTION_KEYWORDS or tokens[0] in UTILITY_KEYWORDS)
    ):
        return tokens[0]
    return " ".join(tokens)


def calculate_intervals(dates: List[datetime]) -> List[int]:
    """Calculate day differences between chronologically sorted dates."""
    intervals = []
    for i in range(len(dates) - 1):
        diff = (dates[i + 1] - dates[i]).days
        if diff > 0:
            intervals.append(diff)
    return intervals


def classify_frequency(median_interval: float) -> Optional[str]:
    """Map median interval days to standard recurrence frequencies."""
    if 5 <= median_interval <= 9:
        return "WEEKLY"
    elif 11 <= median_interval <= 18:
        return "BIWEEKLY"
    elif 25 <= median_interval <= 35:
        return "MONTHLY"
    elif 75 <= median_interval <= 105:
        return "QUARTERLY"
    elif 160 <= median_interval <= 200:
        return "SEMI_ANNUALLY"
    elif 340 <= median_interval <= 390:
        return "ANNUALLY"
    return None


def determine_recurring_type(
    merchant: Optional[str],
    description: Optional[str],
    category: Optional[str],
    amount_cv: float,
) -> str:
    """Classify the detected pattern into an archetype using keywords and amount behavior."""
    m_str = (merchant or "").lower()
    d_str = (description or "").lower()
    c_str = (category or "").lower()
    text = f"{m_str} {d_str} {c_str}"

    # 1. Check EMI patterns (typically high fixed amount, zero/minimal variance)
    for kw in EMI_KEYWORDS:
        if kw in text and amount_cv <= 0.05:
            return "EMI"

    # 2. Check Subscription patterns (fixed amount, subscription keywords or software/entertainment)
    for kw in SUBSCRIPTION_KEYWORDS:
        if kw in text and amount_cv <= 0.15:
            return "SUBSCRIPTION"
    if any(c in c_str for c in ["subscription", "entertainment", "software", "streaming"]) and amount_cv <= 0.15:
        return "SUBSCRIPTION"

    # 3. Check Utility patterns (electricity, broadband, water; allows moderate variance)
    for kw in UTILITY_KEYWORDS:
        if kw in text and amount_cv <= 0.35:
            return "UTILITY"
    if "utilit" in c_str and amount_cv <= 0.35:
        return "UTILITY"

    return "EXPENSE"


def detect_recurring_patterns(
    transactions: List[Dict[str, Any]],
    reference_date: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Analyzes transaction list and returns identified recurring patterns with confidence,
    frequency, next expected date, and activity status.
    """
    if reference_date is None:
        reference_date = datetime.utcnow()

    # Group expenses by normalized merchant AND currency
    clusters: Dict[str, List[Dict[str, Any]]] = {}

    for tx in transactions:
        tx_type = tx.get("type", "EXPENSE").upper()
        if tx_type != "EXPENSE":
            continue

        raw_merchant = tx.get("merchant") or tx.get("description") or "Unknown"
        norm_key = normalize_merchant_name(raw_merchant)

        # Exclude variable discretionary merchants (e.g., Uber taxi rides, Zomato meal delivery)
        if is_discretionary_merchant(raw_merchant, norm_key):
            continue

        currency = (tx.get("currency") or "USD").upper().strip()
        cluster_key = f"{norm_key}___{currency}"

        if cluster_key not in clusters:
            clusters[cluster_key] = []
        clusters[cluster_key].append(tx)

    detected: List[Dict[str, Any]] = []

    for cluster_key, tx_list in clusters.items():
        norm_key, currency = cluster_key.split("___")

        # Parse and sort by date ascending
        parsed_items: List[Tuple[datetime, float, Dict[str, Any]]] = []
        for item in tx_list:
            dt_raw = item.get("date")
            if isinstance(dt_raw, str):
                try:
                    dt = datetime.fromisoformat(dt_raw.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    try:
                        dt = datetime.strptime(dt_raw[:10], "%Y-%m-%d")
                    except Exception:
                        continue
            elif isinstance(dt_raw, datetime):
                dt = dt_raw.replace(tzinfo=None) if dt_raw.tzinfo else dt_raw
            else:
                continue

            amt = float(item.get("amount", 0.0))
            if amt > 0:
                parsed_items.append((dt, amt, item))

        if not parsed_items:
            continue

        parsed_items.sort(key=lambda x: x[0])

        # Deduplicate same-day billing transactions (e.g. duplicate charges on same day)
        day_groups: Dict[str, List[Tuple[datetime, float, Dict[str, Any]]]] = {}
        for p in parsed_items:
            day_str = p[0].strftime("%Y-%m-%d")
            if day_str not in day_groups:
                day_groups[day_str] = []
            day_groups[day_str].append(p)

        billing_events: List[Tuple[datetime, float, Dict[str, Any]]] = [
            day_groups[day_str][-1] for day_str in sorted(day_groups.keys())
        ]

        # Case 1: Exactly 1 billing event (e.g., Hotstar ₹600 single transaction)
        if len(billing_events) == 1:
            latest_tx = billing_events[0][2]
            raw_merchant_str = (latest_tx.get("merchant") or norm_key).lower()
            desc_str = (latest_tx.get("description") or "").lower()
            cat_str = (latest_tx.get("category") or "").lower()

            is_sub_candidate = (
                any(k in raw_merchant_str or k in desc_str or k in norm_key for k in SUBSCRIPTION_KEYWORDS)
                or any(c in cat_str for c in ["subscription", "software", "entertainment", "streaming"])
            )
            is_util_candidate = (
                any(k in raw_merchant_str or k in desc_str or k in norm_key for k in UTILITY_KEYWORDS)
                or "utilit" in cat_str
            )

            if is_sub_candidate or is_util_candidate:
                dt, amt, tx_repr = billing_events[0]
                rec_type = "SUBSCRIPTION" if is_sub_candidate else "UTILITY"
                display_name = tx_repr.get("merchant") or norm_key.title()
                all_ids = [
                    str(p[2].get("_id") or p[2].get("id"))
                    for p in parsed_items
                    if p[2].get("_id") or p[2].get("id")
                ]

                detected.append({
                    "merchant": display_name,
                    "normalizedMerchant": norm_key,
                    "expectedAmount": round(amt, 2),
                    "currency": currency,
                    "frequency": "MONTHLY",
                    "recurringType": rec_type,
                    "confidence": 0.40,
                    "confidenceLevel": "LOW",
                    "tier": "POSSIBLE",
                    "source": "AI_DETECTED",
                    "intervalDays": 30,
                    "transactionCount": len(parsed_items),
                    "lastTransactionDate": dt.isoformat(),
                    "nextExpectedDate": (dt + timedelta(days=30)).isoformat(),
                    "isPossiblyInactive": False,
                    "inactivityEvidence": f"1 transaction detected ({dt.strftime('%b %d, %Y')}). Awaiting more billing cycles to confirm frequency.",
                    "isActive": True,
                    "matchedTransactionIds": all_ids,
                })
            continue

        # Case 2: >= 2 distinct billing events
        amounts_all = [b[1] for b in billing_events]
        mean_all = sum(amounts_all) / len(amounts_all)
        cv_all = (
            math.sqrt(sum((a - mean_all) ** 2 for a in amounts_all) / len(amounts_all)) / mean_all
            if mean_all > 0
            else 0.0
        )

        if cv_all > 0.15:
            median_amt = sorted(amounts_all)[len(amounts_all) // 2]
            modal_events = [
                b for b in billing_events if abs(b[1] - median_amt) / (median_amt or 1.0) <= 0.25
            ]
            if len(modal_events) >= 2:
                billing_events = modal_events

        dates = [b[0] for b in billing_events]
        amounts = [b[1] for b in billing_events]

        intervals = calculate_intervals(dates)
        if not intervals:
            continue

        intervals_sorted = sorted(intervals)
        n_int = len(intervals_sorted)
        median_interval = (
            intervals_sorted[n_int // 2]
            if n_int % 2 != 0
            else (intervals_sorted[n_int // 2 - 1] + intervals_sorted[n_int // 2]) / 2.0
        )

        variance_int = sum((x - median_interval) ** 2 for x in intervals) / len(intervals)
        std_int = math.sqrt(variance_int)

        freq = classify_frequency(median_interval)
        if not freq:
            # If interval does not match a standard cadence, check if known subscription merchant
            latest_tx = billing_events[-1][2]
            raw_merchant_str = (latest_tx.get("merchant") or norm_key).lower()
            if any(k in raw_merchant_str for k in SUBSCRIPTION_KEYWORDS):
                freq = "MONTHLY"
                expected_interval_days = 30
            else:
                continue
        else:
            expected_interval_days = {
                "WEEKLY": 7,
                "BIWEEKLY": 14,
                "MONTHLY": 30,
                "QUARTERLY": 90,
                "SEMI_ANNUALLY": 180,
                "ANNUALLY": 365,
            }[freq]

        # Amount statistics
        mean_amount = sum(amounts) / len(amounts)
        variance_amount = sum((a - mean_amount) ** 2 for a in amounts) / len(amounts)
        std_amount = math.sqrt(variance_amount)
        amount_cv = std_amount / mean_amount if mean_amount > 0 else 0.0

        latest_tx = billing_events[-1][2]
        merchant_name = latest_tx.get("merchant") or norm_key.title()
        description = latest_tx.get("description", "")
        category = latest_tx.get("category", "")

        rec_type = determine_recurring_type(merchant_name, description, category, amount_cv)

        # Variance limits
        max_allowed_cv = 0.35 if rec_type == "UTILITY" else 0.20
        if amount_cv > max_allowed_cv and rec_type != "SUBSCRIPTION":
            continue

        # Confidence Scoring
        interval_score = max(0.0, 1.0 - (std_int / expected_interval_days))
        amount_score = max(0.0, 1.0 - (amount_cv / max_allowed_cv))
        count_factor = 1.0 if len(billing_events) >= 4 else (0.85 if len(billing_events) == 3 else 0.70)

        raw_confidence = (0.5 * interval_score + 0.5 * amount_score) * count_factor
        if rec_type in ["SUBSCRIPTION", "EMI", "UTILITY"]:
            raw_confidence += 0.05

        confidence = round(min(0.99, max(0.50, raw_confidence)), 2)

        if len(billing_events) >= 3 and amount_cv <= 0.15 and interval_score >= 0.7:
            confidence_level = "HIGH"
        elif len(billing_events) >= 2 and amount_cv <= 0.15:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"

        # LATEST VALID PAYMENT ANCHOR
        latest_date = dates[-1]
        next_expected_date = latest_date + timedelta(days=expected_interval_days)

        # Inactivity Assessment
        days_since_last = (reference_date - latest_date).days
        inactivity_threshold = expected_interval_days * 1.5

        if days_since_last > inactivity_threshold:
            is_possibly_inactive = True
            multiple = round(days_since_last / expected_interval_days, 1)
            inactivity_evidence = (
                f"Last transaction detected on {latest_date.strftime('%Y-%m-%d')} "
                f"({days_since_last} days ago). Expected regular {freq.lower()} interval "
                f"is ~{expected_interval_days} days. No transaction detected for {multiple}x "
                "the billing cycle."
            )
            tier = "INACTIVE"
        else:
            is_possibly_inactive = False
            inactivity_evidence = None
            tier = "CONFIRMED"

        all_matched_ids = [
            str(p[2].get("_id") or p[2].get("id"))
            for p in parsed_items
            if p[2].get("_id") or p[2].get("id")
        ]

        detected.append({
            "merchant": merchant_name,
            "normalizedMerchant": norm_key,
            "expectedAmount": round(amounts[-1], 2),
            "currency": currency,
            "frequency": freq,
            "recurringType": rec_type,
            "confidence": confidence,
            "confidenceLevel": confidence_level,
            "tier": tier,
            "source": "AI_DETECTED",
            "intervalDays": expected_interval_days,
            "transactionCount": len(parsed_items),
            "lastTransactionDate": latest_date.isoformat(),
            "nextExpectedDate": next_expected_date.isoformat(),
            "isPossiblyInactive": is_possibly_inactive,
            "inactivityEvidence": inactivity_evidence,
            "isActive": not is_possibly_inactive,
            "matchedTransactionIds": all_matched_ids,
        })

    # Sort: Confirmed first, then Possible, then by confidence descending
    detected.sort(key=lambda x: (1 if x.get("tier") == "CONFIRMED" else (0 if x.get("tier") == "POSSIBLE" else -1), x["confidence"]), reverse=True)
    return detected
