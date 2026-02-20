"""
AI Financial Planner - Constants
Defines constants for currency display, validation, and UI rendering
"""

# ==================== CURRENCY DISPLAY INFORMATION ====================

CURRENCY_DISPLAY_NAMES = {
    # Major Currencies
    'USD': 'US Dollar ($)',
    'EUR': 'Euro (€)',
    'GBP': 'British Pound (£)',
    'JPY': 'Japanese Yen (¥)',
    'CNY': 'Chinese Yuan (¥)',
    'INR': 'Indian Rupee (₹)',
    'CAD': 'Canadian Dollar (C$)',
    'AUD': 'Australian Dollar (A$)',
    'CHF': 'Swiss Franc (CHF)',
    'SEK': 'Swedish Krona (kr)',

    # Asia-Pacific
    'NZD': 'New Zealand Dollar (NZ$)',
    'SGD': 'Singapore Dollar (S$)',
    'HKD': 'Hong Kong Dollar (HK$)',
    'KRW': 'South Korean Won (₩)',
    'THB': 'Thai Baht (฿)',
    'IDR': 'Indonesian Rupiah (Rp)',
    'MYR': 'Malaysian Ringgit (RM)',
    'PHP': 'Philippine Peso (₱)',
    'VND': 'Vietnamese Dong (₫)',
    'PKR': 'Pakistani Rupee (₨)',
    'BDT': 'Bangladeshi Taka (৳)',

    # Europe
    'NOK': 'Norwegian Krone (kr)',
    'DKK': 'Danish Krone (kr)',
    'PLN': 'Polish Złoty (zł)',
    'CZK': 'Czech Koruna (Kč)',
    'HUF': 'Hungarian Forint (Ft)',
    'RON': 'Romanian Leu (lei)',
    'RUB': 'Russian Ruble (₽)',
    'UAH': 'Ukrainian Hryvnia (₴)',
    'TRY': 'Turkish Lira (₺)',

    # Middle East & Africa
    'ILS': 'Israeli Shekel (₪)',
    'AED': 'UAE Dirham (د.إ)',
    'SAR': 'Saudi Riyal (﷼)',
    'QAR': 'Qatari Riyal (﷼)',
    'KWD': 'Kuwaiti Dinar (د.ك)',
    'EGP': 'Egyptian Pound (£)',
    'ZAR': 'South African Rand (R)',
    'NGN': 'Nigerian Naira (₦)',
    'KES': 'Kenyan Shilling (KSh)',
    'GHS': 'Ghanaian Cedi (₵)',

    # Americas
    'MXN': 'Mexican Peso (MX$)',
    'BRL': 'Brazilian Real (R$)',
    'ARS': 'Argentine Peso (ARS$)',
    'COP': 'Colombian Peso (COL$)',
    'CLP': 'Chilean Peso (CLP$)',
    'PEN': 'Peruvian Sol (S/)',
}


CURRENCY_SYMBOLS = {
    # Major Currencies
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'SEK': 'kr',

    # Asia-Pacific
    'NZD': 'NZ$',
    'SGD': 'S$',
    'HKD': 'HK$',
    'KRW': '₩',
    'THB': '฿',
    'IDR': 'Rp',
    'MYR': 'RM',
    'PHP': '₱',
    'VND': '₫',
    'PKR': '₨',
    'BDT': '৳',

    # Europe
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'CZK': 'Kč',
    'HUF': 'Ft',
    'RON': 'lei',
    'RUB': '₽',
    'UAH': '₴',
    'TRY': '₺',

    # Middle East & Africa
    'ILS': '₪',
    'AED': 'د.إ',
    'SAR': '﷼',
    'QAR': '﷼',
    'KWD': 'د.ك',
    'EGP': '£',
    'ZAR': 'R',
    'NGN': '₦',
    'KES': 'KSh',
    'GHS': '₵',

    # Americas
    'MXN': 'MX$',
    'BRL': 'R$',
    'ARS': 'ARS$',
    'COP': 'COL$',
    'CLP': 'CLP$',
    'PEN': 'S/',
}


# ==================== CURRENCY REGIONS ====================

CURRENCY_REGIONS = {
    'North America': ['USD', 'CAD', 'MXN'],
    'Europe': ['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'RUB', 'UAH', 'TRY'],
    'Asia-Pacific': ['JPY', 'CNY', 'INR', 'SGD', 'HKD', 'KRW', 'AUD', 'NZD', 'THB', 'IDR', 'MYR', 'PHP', 'VND', 'PKR', 'BDT'],
    'Middle East': ['AED', 'SAR', 'QAR', 'KWD', 'ILS', 'EGP'],
    'Africa': ['ZAR', 'NGN', 'KES', 'GHS', 'EGP'],
    'South America': ['BRL', 'ARS', 'COP', 'CLP', 'PEN'],
}


# ==================== POPULAR CURRENCIES FOR INTERNATIONAL STUDENTS ====================

POPULAR_STUDENT_CURRENCIES = [
    'USD',  # United States
    'GBP',  # United Kingdom
    'CAD',  # Canada
    'AUD',  # Australia
    'EUR',  # Europe
    'INR',  # India
    'CNY',  # China
    'JPY',  # Japan
    'SGD',  # Singapore
    'NZD',  # New Zealand
]


# ==================== INCOME & SCHOLARSHIP FREQUENCY DISPLAY ====================

INCOME_FREQUENCY_DISPLAY = {
    'WEEKLY': 'Weekly',
    'BI_WEEKLY': 'Bi-weekly (Every 2 weeks)',
    'MONTHLY': 'Monthly',
    'SEMI_MONTHLY': 'Semi-monthly (Twice a month)',
    'IRREGULAR': 'Irregular/Variable',
    'NONE': 'No Income',
}


SCHOLARSHIP_FREQUENCY_DISPLAY = {
    'ONE_TIME': 'One-time Payment',
    'MONTHLY': 'Monthly',
    'QUARTERLY': 'Quarterly',
    'SEMESTER': 'Per Semester',
    'ANNUAL': 'Annual',
    'NONE': 'No Scholarship',
}


# ==================== STUDENT STATUS DISPLAY ====================

STUDENT_STATUS_DISPLAY = {
    'UNDERGRADUATE': 'Undergraduate',
    'GRADUATE': 'Graduate',
    'MASTERS': "Master's Program",
    'PHD': 'PhD/Doctoral',
    'POST_DOC': 'Post-Doctoral',
    'EXCHANGE': 'Exchange Student',
    'CERTIFICATE': 'Certificate Program',
}


# ==================== VISA TYPE DISPLAY ====================

VISA_TYPE_DISPLAY = {
    'F1': 'F-1 Student Visa',
    'J1': 'J-1 Exchange Visitor',
    'M1': 'M-1 Vocational Student',
    'H1B': 'H-1B Work Visa',
    'OPT': 'OPT (Optional Practical Training)',
    'CPT': 'CPT (Curricular Practical Training)',
    'B1_B2': 'B-1/B-2 Tourist/Business',
    'OTHER': 'Other',
    'NONE': 'Not Applicable',
}


# ==================== VALIDATION CONSTANTS ====================

MIN_TRANSACTION_AMOUNT = 0.01
MAX_TRANSACTION_AMOUNT = 999999999.99
MAX_BUDGET_AMOUNT = 999999999.99
MIN_FORECAST_DAYS = 7
MAX_FORECAST_DAYS = 365


# ==================== UI CONSTANTS ====================

DEFAULT_TIMEZONE = 'UTC'
ITEMS_PER_PAGE = 20
MAX_ITEMS_PER_PAGE = 100


# ==================== HELPER FUNCTIONS ====================

def format_currency(amount: float, currency_code: str) -> str:
    """
    Format amount with currency symbol.

    Args:
        amount: The monetary amount
        currency_code: ISO 4217 currency code (e.g., 'USD', 'EUR')

    Returns:
        Formatted string like '$1,234.56' or '€1.234,56'

    Example:
        >>> format_currency(1234.56, 'USD')
        '$1,234.56'
    """
    symbol = CURRENCY_SYMBOLS.get(currency_code, currency_code)

    # Basic formatting (can be enhanced with locale-specific formatting)
    formatted_amount = f"{amount:,.2f}"

    # For most currencies, symbol goes before the amount
    if currency_code in ['EUR', 'SEK', 'NOK', 'DKK']:
        return f"{formatted_amount} {symbol}"
    else:
        return f"{symbol}{formatted_amount}"


def get_currency_display_name(currency_code: str) -> str:
    """
    Get the display name for a currency code.

    Args:
        currency_code: ISO 4217 currency code

    Returns:
        Display name with symbol, or the code itself if not found

    Example:
        >>> get_currency_display_name('USD')
        'US Dollar ($)'
    """
    return CURRENCY_DISPLAY_NAMES.get(currency_code, currency_code)