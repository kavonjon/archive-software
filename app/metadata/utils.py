from datetime import date
import calendar
import re

def get_month_last_day(year, month):
    """Helper function to get the last day of a given month"""
    return calendar.monthrange(year, month)[1]

def parse_standardized_date(date_str):
    """
    Parse standardized date string and return min and max dates.
    Returns tuple of (min_date, max_date) or (None, None) if format is not recognized.
    """
    if not date_str:
        return None, None

    try:
        # YYYY format
        year_only = re.match(r'^(\d{4})$', date_str)
        if year_only:
            year = int(year_only.group(1))
            return (
                date(year, 1, 1),  # January 1st
                date(year, 12, 31)  # December 31st
            )

        # YYYY/MM format
        month_year = re.match(r'^(\d{4})/(\d{2})$', date_str)
        if month_year:
            year = int(month_year.group(1))
            month = int(month_year.group(2))
            last_day = get_month_last_day(year, month)
            return (
                date(year, month, 1),  # First day of month
                date(year, month, last_day)  # Last day of month
            )

        # YYYY/MM/DD format
        full_date = re.match(r'^(\d{4})/(\d{2})/(\d{2})$', date_str)
        if full_date:
            year = int(full_date.group(1))
            month = int(full_date.group(2))
            day = int(full_date.group(3))
            exact_date = date(year, month, day)
            return exact_date, exact_date

        # YYYY-YYYY format
        year_range = re.match(r'^(\d{4})-(\d{4})$', date_str)
        if year_range:
            year1 = int(year_range.group(1))
            year2 = int(year_range.group(2))
            return (
                date(year1, 1, 1),  # January 1st of first year
                date(year2, 12, 31)  # December 31st of second year
            )

        # YYYY/MM-YYYY/MM format
        month_year_range = re.match(r'^(\d{4})/(\d{2})-(\d{4})/(\d{2})$', date_str)
        if month_year_range:
            year1 = int(month_year_range.group(1))
            month1 = int(month_year_range.group(2))
            year2 = int(month_year_range.group(3))
            month2 = int(month_year_range.group(4))
            return (
                date(year1, month1, 1),  # First day of first month
                date(year2, month2, get_month_last_day(year2, month2))  # Last day of last month
            )

        # YYYY/MM/DD-YYYY/MM/DD format
        full_date_range = re.match(r'^(\d{4})/(\d{2})/(\d{2})-(\d{4})/(\d{2})/(\d{2})$', date_str)
        if full_date_range:
            year1 = int(full_date_range.group(1))
            month1 = int(full_date_range.group(2))
            day1 = int(full_date_range.group(3))
            year2 = int(full_date_range.group(4))
            month2 = int(full_date_range.group(5))
            day2 = int(full_date_range.group(6))
            return (
                date(year1, month1, day1),
                date(year2, month2, day2)
            )

        return None, None
    except (ValueError, TypeError):
        # Handle invalid dates (e.g., February 31st)
        return None, None 