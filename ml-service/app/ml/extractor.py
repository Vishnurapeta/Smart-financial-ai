"""Entity Extraction for Natural-Language Financial Inputs."""

import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

KNOWN_MERCHANTS = [
    # Food & Delivery
    "Swiggy",
    "Zomato",
    "Starbucks",
    "McDonald's",
    "KFC",
    "Domino's",
    "Burger King",
    "Subway",
    "Chipotle",
    "Taco Bell",
    "DoorDash",
    "Uber Eats",
    "Blue Tokai",
    "Barbeque Nation",
    "Behrouz Biryani",
    "Baskin Robbins",
    "Dunkin Donuts",
    "Haldiram's",
    "Cafe Coffee Day",
    # Groceries
    "Blinkit",
    "Zepto",
    "Instamart",
    "BigBasket",
    "DMart",
    "Whole Foods",
    "Trader Joe's",
    "Costco",
    "Walmart",
    "Target",
    "Reliance Fresh",
    "Nature's Basket",
    "Spencers",
    # Transportation
    "Uber",
    "Ola",
    "Lyft",
    "Rapido",
    "Indian Oil",
    "Bharat Petroleum",
    "HPCL",
    "Shell",
    "Chevron",
    "Exxon",
    "FASTag",
    "IRCTC",
    "Metro",
    # Utilities & Telecom
    "Airtel",
    "Jio",
    "Vodafone",
    "BESCOM",
    "Tata Power",
    "IGL",
    "ACT Fibernet",
    "Xfinity",
    "Comcast",
    "Verizon",
    "T-Mobile",
    "AT&T",
    "Indane",
    # Subscriptions & Tech
    "Netflix",
    "Spotify",
    "Apple Music",
    "Amazon Prime",
    "Disney Plus",
    "Disney+ Hotstar",
    "YouTube Premium",
    "HBO Max",
    "Hulu",
    "iCloud",
    "Google One",
    "ChatGPT",
    "OpenAI",
    "GitHub",
    "AWS",
    "DigitalOcean",
    "Adobe",
    "Microsoft 365",
    "Notion",
    "Midjourney",
    # Shopping & Retail
    "Amazon",
    "Flipkart",
    "Best Buy",
    "Zara",
    "H&M",
    "Nike",
    "Adidas",
    "Myntra",
    "Uniqlo",
    "Apple Store",
    "IKEA",
    "Decathlon",
    "Sephora",
    "Nykaa",
    "Titan",
    "Home Depot",
    # Healthcare
    "Apollo Pharmacy",
    "Apollo",
    "CVS Pharmacy",
    "Walgreens",
    "Medplus",
    "Cult.fit",
    "Equinox",
    "1mg",
    "Pharmeasy",
    # Entertainment & Travel
    "PVR",
    "INOX",
    "BookMyShow",
    "AMC Theaters",
    "Indigo Airlines",
    "IndiGo",
    "United Airlines",
    "Delta Air Lines",
    "Air India",
    "Marriott",
    "Airbnb",
    "Hilton",
    "MakeMyTrip",
    "Booking.com",
    "Steam",
    "PlayStation",
    "Nintendo",
    # Financial / Crypto / Education
    "Zerodha",
    "Groww",
    "Vanguard",
    "Udemy",
    "Coursera",
    "Google",
    "Microsoft",
    "Upwork",
]


def extract_amount_and_currency(
    text: str, default_currency: str = "INR"
) -> Tuple[Optional[float], str]:
    """Extract numeric monetary amount and currency symbol/code from natural text.

    Supports formats like:
    - Spent ₹750 at Swiggy
    - I spent 800 on dinner
    - Paid $15.99 for netflix
    - 2500 rs electricity bill
    - 45.50 eur dinner
    """
    if not isinstance(text, str) or not text.strip():
        return None, default_currency

    currency = default_currency

    # Check explicit currency markers in text (symbols and codes take precedence)
    if re.search(r"(?:₹|rs\.?|inr|rupees)", text, re.IGNORECASE):
        currency = "INR"
    elif re.search(r"(?:\$|usd|dollars?)", text, re.IGNORECASE):
        currency = "USD"
    elif re.search(r"(?:€|eur|euros?)", text, re.IGNORECASE):
        currency = "EUR"
    elif re.search(r"(?:£|gbp|pounds?)", text, re.IGNORECASE):
        currency = "GBP"

    # Pattern 1: Currency symbol directly before amount (e.g. ₹750, $15.99, Rs. 500)
    match = re.search(r"(?:₹|rs\.?|inr|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
    if match:
        val_str = match.group(1).replace(",", "")
        try:
            return float(val_str), currency
        except ValueError:
            pass

    # Pattern 2: Amount followed by currency symbol/unit (e.g. 750 rs, 1500 inr, 20 dollars)
    match = re.search(
        r"([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr|rupees|\$|usd|dollars?|€|eur|£|gbp)",
        text,
        re.IGNORECASE,
    )
    if match:
        val_str = match.group(1).replace(",", "")
        try:
            return float(val_str), currency
        except ValueError:
            pass

    # Pattern 3: Standalone number following action words (e.g. spent 800, paid 1200, for 450, received 50000)
    match = re.search(
        r"\b(?:spent|paid|cost|for|debited|amount(?:\s+of)?|credited|received)\s+([\d,]+(?:\.\d{1,2})?)\b",
        text,
        re.IGNORECASE,
    )
    if match:
        val_str = match.group(1).replace(",", "")
        try:
            return float(val_str), currency
        except ValueError:
            pass

    # Pattern 4: Any floating point or integer number
    numbers = re.findall(r"\b\d+(?:,\d+)*(?:\.\d{1,2})?\b", text)
    if numbers:
        # Filter out 4-digit years (e.g. 2024, 2025, 2026) only if multiple numbers are found
        for num_str in numbers:
            val = float(num_str.replace(",", ""))
            if val in (2024, 2025, 2026, 2027) and len(numbers) > 1:
                continue
            return val, currency

    return None, currency


def extract_transaction_type(text: str) -> str:
    """Identify if transaction is an INCOME or an EXPENSE.

    Matches income signals like: credited, salary, received, bonus, dividend, refund, deposit.
    Default is EXPENSE.
    """
    if not isinstance(text, str) or not text.strip():
        return "EXPENSE"

    income_signals = [
        "credited",
        "salary",
        "bonus",
        "dividend",
        "received",
        "deposit",
        "earned",
        "refund",
        "payroll",
        "cashback",
        "reimbursement",
        "income",
    ]
    lower = text.lower()
    for signal in income_signals:
        if re.search(rf"\b{signal}\b", lower):
            return "INCOME"

    return "EXPENSE"


def extract_date(text: str, reference_date: Optional[datetime] = None) -> datetime:
    """Extract relative or explicit transaction date from text.

    Supports:
    - yesterday
    - today
    - last night
    - 2 days ago
    - YYYY-MM-DD or DD/MM/YYYY
    Defaults to current UTC date.
    """
    ref = reference_date or datetime.now(timezone.utc)
    if not isinstance(text, str) or not text.strip():
        return ref

    lower = text.lower()

    if re.search(r"\byesterday\b", lower) or re.search(r"\blast\s+night\b", lower):
        return ref - timedelta(days=1)

    if re.search(r"\btoday\b", lower):
        return ref

    # "X days ago"
    match = re.search(r"\b(\d+)\s+days?\s+ago\b", lower)
    if match:
        days = int(match.group(1))
        return ref - timedelta(days=days)

    # ISO Format: YYYY-MM-DD
    match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    if match:
        try:
            return datetime(
                int(match.group(1)), int(match.group(2)), int(match.group(3)), tzinfo=timezone.utc
            )
        except ValueError:
            pass

    return ref


def is_amount_approximate(text: str) -> bool:
    """Detect if the transaction expression contains approximation modifiers."""
    if not isinstance(text, str) or not text.strip():
        return False
    return bool(
        re.search(
            r"\b(?:around|about|approx(?:imately)?|roughly|nearly|almost|close\s+to|estimated?)\b",
            text,
            re.IGNORECASE,
        )
    )


# Words and phrases that MUST NEVER be treated as a merchant or payee name
FORBIDDEN_MERCHANT_WORDS = {
    "around",
    "about",
    "approx",
    "approximately",
    "roughly",
    "nearly",
    "almost",
    "close",
    "estimated",
    "spent",
    "spend",
    "paid",
    "pay",
    "bought",
    "buy",
    "purchase",
    "purchased",
    "cost",
    "costs",
    "fee",
    "fees",
    "charge",
    "charges",
    "bill",
    "bills",
    "transfer",
    "debited",
    "credited",
    "received",
    "got",
    "today",
    "yesterday",
    "tomorrow",
    "last",
    "night",
    "morning",
    "evening",
    "afternoon",
    "day",
    "week",
    "month",
    "year",
    "on",
    "at",
    "for",
    "from",
    "to",
    "in",
    "by",
    "via",
    "with",
    "into",
    "of",
    "a",
    "an",
    "the",
    "my",
    "our",
    "your",
    "his",
    "her",
    "their",
    "its",
    "i",
    "we",
    "you",
    "they",
    "me",
    "some",
    "any",
    "this",
    "that",
    "these",
    "those",
    "money",
    "cash",
    "rupees",
    "dollars",
    "bucks",
    "rs",
    "inr",
    "usd",
    "eur",
    "gbp",
    "account",
    "bank",
    "card",
    "debit",
    "credit",
    "upi",
    "dinner",
    "lunch",
    "breakfast",
    "meal",
    "food",
    "item",
    "items",
    "stuff",
    "thing",
    "things",
}


def extract_merchant(text: str) -> Optional[str]:
    """Identify the merchant/vendor from natural text using contextual entity extraction.

    1. Matches known specific brand names (e.g. Swiggy, Zomato, Uber, PVR, Netflix).
    2. Recognizes semantic entity domains (e.g. movie/cinema -> Movie / Cinema, groceries -> Groceries).
    3. Extracts noun entities from prepositional context ('at ...', 'on ...', 'for ...').
    4. Rejects modifier words ('around', 'about', 'approximately', etc.).
    """
    if not isinstance(text, str) or not text.strip():
        return None

    lower_text = text.lower()

    # 1. Exact match against known merchants (case-insensitive)
    for merchant in KNOWN_MERCHANTS:
        pattern = rf"\b{re.escape(merchant.lower())}\b"
        if re.search(pattern, lower_text):
            return merchant

    # 2. Contextual domain noun extraction
    # Movie / Cinema
    if re.search(r"\b(?:movie|cinema|theatre|theater|multiplex|imax|film)\b", lower_text):
        return "Movie / Cinema"

    # Ride Sharing / Transit
    if re.search(r"\b(?:uber\s+ride|ola\s+cab|rapido\s+bike|taxi\s+ride|cab\s+fare)\b", lower_text):
        if "uber" in lower_text:
            return "Uber"
        if "ola" in lower_text:
            return "Ola"
        if "rapido" in lower_text:
            return "Rapido"
        return "Taxi Service"

    # Food & Dining
    if re.search(r"\b(?:swiggy|zomato|doordash|ubereats|uber\s+eats)\b", lower_text):
        if "swiggy" in lower_text:
            return "Swiggy"
        if "zomato" in lower_text:
            return "Zomato"
        if "ubereats" in lower_text or "uber eats" in lower_text:
            return "Uber Eats"
        return "Food Delivery"

    # Video Games / Gaming
    if re.search(r"\b(?:game|gaming|steam|playstation|xbox|nintendo)\b", lower_text):
        if "steam" in lower_text:
            return "Steam"
        if "playstation" in lower_text:
            return "PlayStation"
        if "xbox" in lower_text:
            return "Xbox"
        if "nintendo" in lower_text:
            return "Nintendo"
        return "Game"

    # Groceries
    if re.search(r"\b(?:groceries|grocery|supermarket)\b", lower_text):
        return "Groceries"

    # Utilities
    if re.search(r"\b(?:electricity|electric\s+bill|power\s+bill)\b", lower_text):
        return "Electricity Provider"
    if re.search(r"\b(?:water\s+bill)\b", lower_text):
        return "Water Utility"
    if re.search(r"\b(?:gas\s+bill|lpg\s+cylinder)\b", lower_text):
        return "Gas Utility"
    if re.search(r"\b(?:broadband|wifi|internet\s+bill)\b", lower_text):
        return "Internet Provider"

    # Salary / Payroll
    if re.search(r"\b(?:salary|payroll|stipend|bonus)\b", lower_text):
        company_match = re.search(r"\bfrom\s+([A-Za-z0-9'&.-]+(?:\s+[A-Za-z0-9'&.-]+)?)\b", text, re.IGNORECASE)
        if company_match:
            cand = company_match.group(1).strip()
            if cand.lower() not in FORBIDDEN_MERCHANT_WORDS:
                return cand.title()
        return "Employer"

    # 3. Extract entities after prepositions: at, on, for, from, to
    # E.g. "at Reliance Fresh", "on a movie", "for groceries"
    prep_matches = re.finditer(
        r"\b(?:at|from|to|on|for)\s+(?:an?\s+|the\s+)?([A-Za-z0-9'&.-]+(?:\s+[A-Za-z0-9'&.-]+)?)\b",
        text,
        re.IGNORECASE,
    )
    for match in prep_matches:
        candidate = match.group(1).strip()
        tokens = candidate.lower().split()
        # Ensure candidate is not composed solely of forbidden/filler words
        valid_tokens = [t for t in tokens if t not in FORBIDDEN_MERCHANT_WORDS]
        if valid_tokens:
            cleaned_candidate = " ".join(valid_tokens).title()
            return cleaned_candidate

    return None

