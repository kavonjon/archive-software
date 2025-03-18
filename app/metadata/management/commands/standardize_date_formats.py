from django.core.management.base import BaseCommand
import re
from metadata.models import Item

class Command(BaseCommand):
    help = 'Standardizes date formats to YYYY/MM/DD where possible'

    def standardize_single_date(self, date_str):
        """Standardize a single date component"""
        if not date_str:
            return date_str
            
        # YYYY format
        year_only = re.match(r'^(\d{4})$', date_str)
        if year_only:
            return date_str

        # MM/DD/YYYY format
        full_date = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', date_str)
        if full_date:
            month, day, year = full_date.groups()
            return f"{year}/{month.zfill(2)}/{day.zfill(2)}"

        # MM/YYYY format
        month_year = re.match(r'^(\d{1,2})/(\d{4})$', date_str)
        if month_year:
            month, year = month_year.groups()
            return f"{year}/{month.zfill(2)}"

        return None

    def standardize_date(self, date_str):
        """Standardize date string, handling both single dates and ranges"""
        if not date_str:
            return date_str

        # YYYY-YYYY format (preserve as is)
        year_range = re.match(r'^(\d{4})-(\d{4})$', date_str)
        if year_range:
            return date_str

        # MM/YYYY-MM/YYYY format
        month_year_range = re.match(r'^(\d{1,2})/(\d{4})-(\d{1,2})/(\d{4})$', date_str)
        if month_year_range:
            month1, year1, month2, year2 = month_year_range.groups()
            return f"{year1}/{month1.zfill(2)}-{year2}/{month2.zfill(2)}"

        # MM/DD/YYYY-MM/DD/YYYY format
        full_date_range = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})-(\d{1,2})/(\d{1,2})/(\d{4})$', date_str)
        if full_date_range:
            month1, day1, year1, month2, day2, year2 = full_date_range.groups()
            return f"{year1}/{month1.zfill(2)}/{day1.zfill(2)}-{year2}/{month2.zfill(2)}/{day2.zfill(2)}"

        # If not a range, try to standardize as single date
        return self.standardize_single_date(date_str)

    def handle(self, *args, **options):
        date_fields = [
            'accession_date',
            'cataloged_date',
            'collection_date',
            'creation_date',
            'deposit_date'
        ]

        items = Item.objects.exclude(**{
            f'{field}__exact': '' for field in date_fields
        }).exclude(**{
            f'{field}__isnull': True for field in date_fields
        })

        for item in items:
            self.stdout.write(f"Processing item {item.catalog_number}")
            
            for field in date_fields:
                original_value = getattr(item, field)
                if not original_value:
                    continue

                standardized_date = self.standardize_date(original_value)
                
                if original_value and standardized_date is None:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  {field}: Unable to standardize date format '{original_value}'"
                        )
                    )
                    continue

                if standardized_date != original_value:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  {field}: Converting '{original_value}' to '{standardized_date}'"
                        )
                    )
                    setattr(item, field, standardized_date)
                    item.save()

        self.stdout.write(self.style.SUCCESS('Date standardization completed')) 