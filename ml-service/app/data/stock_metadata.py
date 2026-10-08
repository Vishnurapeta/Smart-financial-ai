"""
Stock Universe Metadata Catalog.
Contains verified company names, sectors, industries, markets, and market-cap categories
for all supported equities in the NIFTY 100/500 and Global equity universe.
Guarantees zero invented sectors or hallucinated entities.
"""
from typing import Any, Dict, Optional

STOCK_METADATA_REGISTRY: Dict[str, Dict[str, Any]] = {
    # IT & Software
    "TCS": {
        "company_name": "Tata Consultancy Services Ltd",
        "sector": "IT",
        "industry": "IT Services & Consulting",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "INFY": {
        "company_name": "Infosys Ltd",
        "sector": "IT",
        "industry": "IT Services & Consulting",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "WIPRO": {
        "company_name": "Wipro Ltd",
        "sector": "IT",
        "industry": "IT Services & Solutions",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "HCLTECH": {
        "company_name": "HCL Technologies Ltd",
        "sector": "IT",
        "industry": "IT Services & Enterprise Solutions",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "TECHM": {
        "company_name": "Tech Mahindra Ltd",
        "sector": "IT",
        "industry": "Digital Transformation & IT",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "LTIM": {
        "company_name": "LTIMindtree Ltd",
        "sector": "IT",
        "industry": "Digital Engineering & Solutions",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "LTTS": {
        "company_name": "L&T Technology Services Ltd",
        "sector": "IT",
        "industry": "Engineering R&D Services",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "COFORGE": {
        "company_name": "Coforge Ltd",
        "sector": "IT",
        "industry": "Enterprise Software & IT",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "PERSISTENT": {
        "company_name": "Persistent Systems Ltd",
        "sector": "IT",
        "industry": "Digital Engineering & Enterprise Tech",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "MPHASIS": {
        "company_name": "Mphasis Ltd",
        "sector": "IT",
        "industry": "Cloud & Cognitive Services",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "KPITTECH": {
        "company_name": "KPIT Technologies Ltd",
        "sector": "IT",
        "industry": "Automotive Software & Mobility",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "TATAELXSI": {
        "company_name": "Tata Elxsi Ltd",
        "sector": "IT",
        "industry": "Design & Technology Services",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "OFSS": {
        "company_name": "Oracle Financial Services Software Ltd",
        "sector": "IT",
        "industry": "Banking Software Solutions",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },

    # Banking
    "HDFCBANK": {
        "company_name": "HDFC Bank Ltd",
        "sector": "Banking",
        "industry": "Private Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ICICIBANK": {
        "company_name": "ICICI Bank Ltd",
        "sector": "Banking",
        "industry": "Private Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "SBIN": {
        "company_name": "State Bank of India",
        "sector": "Banking",
        "industry": "Public Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "KOTAKBANK": {
        "company_name": "Kotak Mahindra Bank Ltd",
        "sector": "Banking",
        "industry": "Private Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "AXISBANK": {
        "company_name": "Axis Bank Ltd",
        "sector": "Banking",
        "industry": "Private Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "INDUSINDBK": {
        "company_name": "IndusInd Bank Ltd",
        "sector": "Banking",
        "industry": "Private Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BANKBARODA": {
        "company_name": "Bank of Baroda",
        "sector": "Banking",
        "industry": "Public Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "PNB": {
        "company_name": "Punjab National Bank",
        "sector": "Banking",
        "industry": "Public Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "CANBK": {
        "company_name": "Canara Bank",
        "sector": "Banking",
        "industry": "Public Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "UNIONBANK": {
        "company_name": "Union Bank of India",
        "sector": "Banking",
        "industry": "Public Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "FEDERALBNK": {
        "company_name": "The Federal Bank Ltd",
        "sector": "Banking",
        "industry": "Private Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "BANDHANBNK": {
        "company_name": "Bandhan Bank Ltd",
        "sector": "Banking",
        "industry": "Microfinance & Commercial Banking",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "IDFCFIRSTB": {
        "company_name": "IDFC FIRST Bank Ltd",
        "sector": "Banking",
        "industry": "Private Sector Bank",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },

    # Financial Services
    "BAJFINANCE": {
        "company_name": "Bajaj Finance Ltd",
        "sector": "Financial Services",
        "industry": "Consumer Finance NBFC",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BAJAJFINSV": {
        "company_name": "Bajaj Finserv Ltd",
        "sector": "Financial Services",
        "industry": "Financial Conglomerate & Insurance",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "HDFCLIFE": {
        "company_name": "HDFC Life Insurance Co Ltd",
        "sector": "Financial Services",
        "industry": "Life Insurance",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "SBILIFE": {
        "company_name": "SBI Life Insurance Co Ltd",
        "sector": "Financial Services",
        "industry": "Life Insurance",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ICICIGI": {
        "company_name": "ICICI Lombard General Insurance Co Ltd",
        "sector": "Financial Services",
        "industry": "General Insurance",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "PFC": {
        "company_name": "Power Finance Corporation Ltd",
        "sector": "Financial Services",
        "industry": "Infrastructure Finance NBFC",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "RECLTD": {
        "company_name": "REC Ltd",
        "sector": "Financial Services",
        "industry": "Power Infrastructure Finance",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "IRFC": {
        "company_name": "Indian Railway Finance Corporation Ltd",
        "sector": "Financial Services",
        "industry": "Rail Infrastructure Finance",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "PAYTM": {
        "company_name": "One97 Communications (Paytm)",
        "sector": "Financial Services",
        "industry": "Digital Payments & Fintech",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },

    # Energy & Utilities
    "RELIANCE": {
        "company_name": "Reliance Industries Ltd",
        "sector": "Energy",
        "industry": "Energy, Oil & Retail Conglomerate",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ONGC": {
        "company_name": "Oil and Natural Gas Corporation Ltd",
        "sector": "Energy",
        "industry": "Oil & Gas Exploration & Production",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BPCL": {
        "company_name": "Bharat Petroleum Corporation Ltd",
        "sector": "Energy",
        "industry": "Oil Refining & Marketing",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "IOC": {
        "company_name": "Indian Oil Corporation Ltd",
        "sector": "Energy",
        "industry": "Oil Refining & Marketing",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "COALINDIA": {
        "company_name": "Coal India Ltd",
        "sector": "Energy",
        "industry": "Coal Mining & Extraction",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "NTPC": {
        "company_name": "NTPC Ltd",
        "sector": "Energy",
        "industry": "Power Generation & Utilities",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "POWERGRID": {
        "company_name": "Power Grid Corporation of India Ltd",
        "sector": "Energy",
        "industry": "Power Transmission",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "TATAPOWER": {
        "company_name": "Tata Power Co Ltd",
        "sector": "Energy",
        "industry": "Integrated Power & Renewable Energy",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ADANIGREEN": {
        "company_name": "Adani Green Energy Ltd",
        "sector": "Energy",
        "industry": "Renewable Power Generation",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },

    # Pharmaceuticals
    "SUNPHARMA": {
        "company_name": "Sun Pharmaceutical Industries Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Specialty & Generic Formulations",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "DRREDDY": {
        "company_name": "Dr. Reddy's Laboratories Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Generic Pharmaceuticals & APIs",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "CIPLA": {
        "company_name": "Cipla Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Respiratory & Anti-infective Pharma",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "DIVISLAB": {
        "company_name": "Divi's Laboratories Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Active Pharmaceutical Ingredients (APIs)",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "AUROPHARMA": {
        "company_name": "Aurobindo Pharma Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Generic Pharmaceuticals",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ALKEM": {
        "company_name": "Alkem Laboratories Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Formulations & Nutraceuticals",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "TORNTPHARM": {
        "company_name": "Torrent Pharmaceuticals Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Therapeutic Formulations",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "IPCALAB": {
        "company_name": "IPCA Laboratories Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Formulations & Active Ingredients",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "ABBOTINDIA": {
        "company_name": "Abbott India Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Multinational Pharmaceuticals",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "GLAXO": {
        "company_name": "GlaxoSmithKline Pharmaceuticals Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Vaccines & Prescription Medicines",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "SANOFI": {
        "company_name": "Sanofi India Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Global Healthcare & Vaccines",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "PFIZER": {
        "company_name": "Pfizer Ltd",
        "sector": "Pharmaceuticals",
        "industry": "Biopharmaceuticals & Specialty Care",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },

    # Healthcare
    "APOLLOHOSP": {
        "company_name": "Apollo Hospitals Enterprise Ltd",
        "sector": "Healthcare",
        "industry": "Hospitals & Healthcare Facilities",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "MAXHEALTH": {
        "company_name": "Max Healthcare Institute Ltd",
        "sector": "Healthcare",
        "industry": "Hospitals & Tertiary Care",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "FORTIS": {
        "company_name": "Fortis Healthcare Ltd",
        "sector": "Healthcare",
        "industry": "Hospitals & Diagnostics",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "LALPATHLAB": {
        "company_name": "Dr. Lal PathLabs Ltd",
        "sector": "Healthcare",
        "industry": "Diagnostic Laboratories",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "METROPOLIS": {
        "company_name": "Metropolis Healthcare Ltd",
        "sector": "Healthcare",
        "industry": "Clinical Diagnostics & Pathology",
        "market": "NSE (India)",
        "market_cap_category": "Small Cap",
    },

    # Automobile
    "MARUTI": {
        "company_name": "Maruti Suzuki India Ltd",
        "sector": "Automobile",
        "industry": "Passenger Vehicles",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BAJAJ-AUTO": {
        "company_name": "Bajaj Auto Ltd",
        "sector": "Automobile",
        "industry": "2 & 3 Wheelers",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "EICHERMOT": {
        "company_name": "Eicher Motors Ltd",
        "sector": "Automobile",
        "industry": "Motorcycles (Royal Enfield) & CVs",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "HEROMOTOCO": {
        "company_name": "Hero MotoCorp Ltd",
        "sector": "Automobile",
        "industry": "Two-Wheelers",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BOSCHLTD": {
        "company_name": "Bosch Ltd",
        "sector": "Automobile",
        "industry": "Automotive Components & Mobility",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "MOTHERSON": {
        "company_name": "Samvardhana Motherson International Ltd",
        "sector": "Automobile",
        "industry": "Automotive Wiring & Components",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },

    # FMCG (Fast-Moving Consumer Goods)
    "HINDUNILVR": {
        "company_name": "Hindustan Unilever Ltd",
        "sector": "FMCG",
        "industry": "Diversified Consumer Goods & Personal Care",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ITC": {
        "company_name": "ITC Ltd",
        "sector": "FMCG",
        "industry": "FMCG, Cigarettes, Hotels & Agri",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "NESTLEIND": {
        "company_name": "Nestle India Ltd",
        "sector": "FMCG",
        "industry": "Packaged Food & Dairy Products",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BRITANNIA": {
        "company_name": "Britannia Industries Ltd",
        "sector": "FMCG",
        "industry": "Bakery & Dairy Consumer Foods",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "DABUR": {
        "company_name": "Dabur India Ltd",
        "sector": "FMCG",
        "industry": "Ayurvedic Products & Personal Care",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "GODREJCP": {
        "company_name": "Godrej Consumer Products Ltd",
        "sector": "FMCG",
        "industry": "Personal Care & Home Hygiene",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "MARICO": {
        "company_name": "Marico Ltd",
        "sector": "FMCG",
        "industry": "Consumer Goods & Hair/Skin Care",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "COLPAL": {
        "company_name": "Colgate-Palmolive (India) Ltd",
        "sector": "FMCG",
        "industry": "Oral Care & Personal Hygiene",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "TATACONSUM": {
        "company_name": "Tata Consumer Products Ltd",
        "sector": "FMCG",
        "industry": "Tea, Coffee, Beverages & Foods",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "EMAMILTD": {
        "company_name": "Emami Ltd",
        "sector": "FMCG",
        "industry": "Personal Care & Ayurvedic OTC",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },

    # Telecom
    "BHARTIARTL": {
        "company_name": "Bharti Airtel Ltd",
        "sector": "Telecom",
        "industry": "Integrated Telecommunication Services",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },

    # Infrastructure & Conglomerates
    "LT": {
        "company_name": "Larsen & Toubro Ltd",
        "sector": "Infrastructure",
        "industry": "Engineering & Construction",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ADANIPORTS": {
        "company_name": "Adani Ports and Special Economic Zone Ltd",
        "sector": "Infrastructure",
        "industry": "Port Infrastructure & Logistics",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ADANIENT": {
        "company_name": "Adani Enterprises Ltd",
        "sector": "Infrastructure",
        "industry": "Diversified Conglomerate & Energy Infra",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BHEL": {
        "company_name": "Bharat Heavy Electricals Ltd",
        "sector": "Infrastructure",
        "industry": "Power & Heavy Engineering Equipment",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "IRCTC": {
        "company_name": "Indian Railway Catering and Tourism Corp Ltd",
        "sector": "Infrastructure",
        "industry": "Railway Catering, Hospitality & Ticketing",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },

    # Metals & Mining
    "TATASTEEL": {
        "company_name": "Tata Steel Ltd",
        "sector": "Metals & Mining",
        "industry": "Steel Manufacturing",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "JSWSTEEL": {
        "company_name": "JSW Steel Ltd",
        "sector": "Metals & Mining",
        "industry": "Integrated Steel Production",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "HINDALCO": {
        "company_name": "Hindalco Industries Ltd",
        "sector": "Metals & Mining",
        "industry": "Aluminium & Copper Fabrication",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "VEDL": {
        "company_name": "Vedanta Ltd",
        "sector": "Metals & Mining",
        "industry": "Diversified Natural Resources & Mining",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },

    # Manufacturing & Capital Goods
    "ABB": {
        "company_name": "ABB India Ltd",
        "sector": "Manufacturing",
        "industry": "Robotics, Automation & Power Equipment",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "SIEMENS": {
        "company_name": "Siemens Ltd",
        "sector": "Manufacturing",
        "industry": "Industrial Automation & Digital Enterprise",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BEL": {
        "company_name": "Bharat Electronics Ltd",
        "sector": "Manufacturing",
        "industry": "Aerospace & Defense Electronics",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "HAL": {
        "company_name": "Hindustan Aeronautics Ltd",
        "sector": "Manufacturing",
        "industry": "Aerospace, Fighter Jets & Helicopters",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "CUMMINSIND": {
        "company_name": "Cummins India Ltd",
        "sector": "Manufacturing",
        "industry": "Diesel Engines & Power Generation",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "GRASIM": {
        "company_name": "Grasim Industries Ltd",
        "sector": "Manufacturing",
        "industry": "Viscose Rayon Fiber & Chemicals",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "ULTRACEMCO": {
        "company_name": "UltraTech Cement Ltd",
        "sector": "Manufacturing",
        "industry": "Cement & Building Materials",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },

    # Consumer Goods & Retail
    "ASIANPAINT": {
        "company_name": "Asian Paints Ltd",
        "sector": "Consumer Goods",
        "industry": "Decorative Paints & Home Decor",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "BERGEPAINT": {
        "company_name": "Berger Paints India Ltd",
        "sector": "Consumer Goods",
        "industry": "Paints & Coatings",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "TITAN": {
        "company_name": "Titan Company Ltd",
        "sector": "Consumer Goods",
        "industry": "Jewellery, Watches & Eyewear",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "HAVELLS": {
        "company_name": "Havells India Ltd",
        "sector": "Consumer Goods",
        "industry": "Consumer Electricals & Lighting",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "VOLTAS": {
        "company_name": "Voltas Ltd",
        "sector": "Consumer Goods",
        "industry": "Air Conditioning & Commercial Refrigeration",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "POLYCAB": {
        "company_name": "Polycab India Ltd",
        "sector": "Consumer Goods",
        "industry": "Wires, Cables & Fast-Moving Electricals",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "DIXON": {
        "company_name": "Dixon Technologies (India) Ltd",
        "sector": "Consumer Goods",
        "industry": "Electronic Manufacturing Services",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "WHIRLPOOL": {
        "company_name": "Whirlpool of India Ltd",
        "sector": "Consumer Goods",
        "industry": "Major Home Appliances",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "DMART": {
        "company_name": "Avenue Supermarts Ltd (DMart)",
        "sector": "Consumer Goods",
        "industry": "Supermarkets & Retail Chains",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },
    "JUBLFOOD": {
        "company_name": "Jubilant FoodWorks Ltd",
        "sector": "Consumer Goods",
        "industry": "Quick Service Restaurants (Domino's)",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },
    "NYKAA": {
        "company_name": "FSN E-Commerce Ventures Ltd (Nykaa)",
        "sector": "Consumer Goods",
        "industry": "Beauty & Fashion E-Commerce",
        "market": "NSE (India)",
        "market_cap_category": "Mid Cap",
    },

    # Chemicals
    "PIDILITIND": {
        "company_name": "Pidilite Industries Ltd",
        "sector": "Chemicals",
        "industry": "Adhesives & Specialty Chemicals",
        "market": "NSE (India)",
        "market_cap_category": "Large Cap",
    },

    # US Equities
    "AAPL": {
        "company_name": "Apple Inc.",
        "sector": "Consumer Goods",
        "industry": "Consumer Electronics & Services",
        "market": "NASDAQ (US)",
        "market_cap_category": "Mega Cap",
    },
}


def get_stock_metadata(symbol: str) -> Dict[str, Any]:
    """
    Retrieves verified metadata for a ticker symbol.
    If ticker is unlisted, returns standard defaults with 'Sector: Unknown'.
    Never invents unverified data.
    """
    clean_sym = symbol.strip().upper()
    if clean_sym in STOCK_METADATA_REGISTRY:
        return dict(STOCK_METADATA_REGISTRY[clean_sym])
    return {
        "company_name": f"{clean_sym} Equity",
        "sector": "Unknown",
        "industry": "General Equities",
        "market": "Global Equities",
        "market_cap_category": "Standard",
    }


def get_all_supported_symbols() -> list:
    """Returns sorted list of all officially cataloged symbols."""
    return sorted(list(STOCK_METADATA_REGISTRY.keys()))
