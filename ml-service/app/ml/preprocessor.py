"""Text Cleaning and Feature Preprocessing for Financial Natural Language Inputs."""

import re

# Custom financial stopwords to remove while preserving brand names and intent terms
STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "in",
    "on",
    "at",
    "to",
    "for",
    "from",
    "by",
    "with",
    "of",
    "about",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "up",
    "down",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "i",
    "my",
    "me",
    "we",
    "our",
    "you",
    "your",
    "he",
    "she",
    "it",
    "they",
    "this",
    "that",
    "these",
    "those",
    "am",
    "via",
    "using",
    "through",
    "please",
    "can",
    "could",
    "would",
    # Approximation & quantifier modifiers (must not skew category classification)
    "around",
    "about",
    "approx",
    "approximately",
    "roughly",
    "nearly",
    "almost",
    "some",
    "any",
    # Generic financial transaction verbs
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
    "charged",
    "debited",
}



def clean_text(raw_text: str) -> str:
    """Preprocess raw financial query/statement into cleaned normalized representation.

    Removes currencies, numbers, dates, and extra punctuation so TF-IDF operates
    on semantic brand names, items, and action descriptors.
    """
    if not isinstance(raw_text, str) or not raw_text.strip():
        return ""

    text = raw_text.lower().strip()

    # 1. Normalize currency words and symbols
    text = re.sub(r"(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)", " ", text, flags=re.IGNORECASE)

    # 2. Remove transaction codes / reference IDs (e.g. TXN12345, REF:9876)
    text = re.sub(r"\b(?:txn|ref|utr|id)[\w:-]+\b", " ", text, flags=re.IGNORECASE)

    # 3. Remove date tokens (e.g. yesterday, today, 2026-09-27, 15/09/2026)
    text = re.sub(r"\b(?:yesterday|today|tomorrow|last\s+night)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b", " ", text)
    text = re.sub(
        r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )

    # 4. Remove floating point and integer numbers (amounts)
    text = re.sub(r"\b\d+(?:,\d+)*(?:\.\d+)?\b", " ", text)

    # 5. Remove punctuation except internal hyphens / apostrophes for brands (e.g. mcdonald's)
    text = re.sub(r"[^\w\s'-]", " ", text)

    # 6. Filter stopwords
    tokens = text.split()
    filtered = [token for token in tokens if token not in STOPWORDS and len(token) > 1]

    return " ".join(filtered)
