"""
Django management command to strip Unicode BiDi control characters from text fields.

Removes invisible BiDi formatting characters that are typically input artifacts from
copy-pasting from Word, browsers, etc. Uses conservative approach: only strips BiDi
controls when no actual RTL (Right-to-Left) script content is present.

Usage:
    python manage.py strip_bidi_controls <app_label> <model_name> <field_name>
    python manage.py strip_bidi_controls metadata Languoid alt_name --dry-run
    python manage.py strip_bidi_controls metadata Collaborator name --dry-run

Examples:
    # Clean alt_name field on Languoid model
    python manage.py strip_bidi_controls metadata Languoid alt_name
    
    # Clean notes field on Item model (dry run first)
    python manage.py strip_bidi_controls metadata Item notes --dry-run
"""

import re
import unicodedata
from django.core.management.base import BaseCommand, CommandError
from django.apps import apps


# All Unicode BiDi control characters
BIDI_CONTROL_CHARS = [
    '\u200E',  # LEFT-TO-RIGHT MARK
    '\u200F',  # RIGHT-TO-LEFT MARK
    '\u202A',  # LEFT-TO-RIGHT EMBEDDING
    '\u202B',  # RIGHT-TO-LEFT EMBEDDING
    '\u202C',  # POP DIRECTIONAL FORMATTING
    '\u202D',  # LEFT-TO-RIGHT OVERRIDE
    '\u202E',  # RIGHT-TO-LEFT OVERRIDE
    '\u2066',  # LEFT-TO-RIGHT ISOLATE
    '\u2067',  # RIGHT-TO-LEFT ISOLATE
    '\u2068',  # FIRST STRONG ISOLATE
    '\u2069',  # POP DIRECTIONAL ISOLATE
]


class Command(BaseCommand):
    help = 'Strip Unicode BiDi control characters from a specified field'

    def add_arguments(self, parser):
        parser.add_argument(
            'app_label',
            type=str,
            help='App label (e.g., "metadata")',
        )
        parser.add_argument(
            'model_name',
            type=str,
            help='Model name (e.g., "Languoid")',
        )
        parser.add_argument(
            'field_name',
            type=str,
            help='Field name to clean (e.g., "alt_name")',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually making changes',
        )
        parser.add_argument(
            '--show-details',
            action='store_true',
            help='Show detailed information about each change',
        )

    def handle(self, *args, **options):
        app_label = options['app_label']
        model_name = options['model_name']
        field_name = options['field_name']
        dry_run = options['dry_run']
        show_details = options['show_details']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved\n'))
        
        # Get the model
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError:
            raise CommandError(
                f'Model "{app_label}.{model_name}" not found. '
                f'Check app_label and model_name are correct.'
            )
        
        # Verify field exists
        try:
            field = Model._meta.get_field(field_name)
        except Exception:
            raise CommandError(
                f'Field "{field_name}" not found on model {Model.__name__}. '
                f'Available fields: {", ".join(f.name for f in Model._meta.fields)}'
            )
        
        # Verify field is a text field
        if not hasattr(field, 'max_length'):
            raise CommandError(
                f'Field "{field_name}" is not a text field (CharField or TextField)'
            )
        
        self.stdout.write(self.style.SUCCESS(
            f'Starting BiDi control character cleanup...\n'
            f'Model: {app_label}.{model_name}\n'
            f'Field: {field_name}\n'
        ))
        
        # Get all records
        records = Model.objects.all()
        total_count = records.count()
        
        self.stdout.write(f'Found {total_count} records to process\n')
        
        # Counters for reporting
        cleaned = 0
        skipped_empty = 0
        skipped_no_bidi = 0
        skipped_has_rtl = 0
        errors = 0
        
        for idx, record in enumerate(records, 1):
            try:
                result = self.process_record(
                    record, 
                    field_name, 
                    dry_run, 
                    show_details
                )
                
                if result == 'cleaned':
                    cleaned += 1
                elif result == 'skipped_empty':
                    skipped_empty += 1
                elif result == 'skipped_no_bidi':
                    skipped_no_bidi += 1
                elif result == 'skipped_has_rtl':
                    skipped_has_rtl += 1
                
                # Progress indicator every 100 records
                if idx % 100 == 0:
                    self.stdout.write(f'Processed {idx}/{total_count} records...')
                    
            except Exception as e:
                errors += 1
                self.stdout.write(
                    self.style.ERROR(
                        f'Error processing record {record.pk}: {e}'
                    )
                )
        
        # Final report
        self.stdout.write(self.style.SUCCESS('\n=== Cleanup Complete ==='))
        self.stdout.write(f'Total records: {total_count}')
        self.stdout.write(self.style.SUCCESS(f'Cleaned (BiDi controls removed): {cleaned}'))
        self.stdout.write(f'Skipped (empty field): {skipped_empty}')
        self.stdout.write(f'Skipped (no BiDi controls found): {skipped_no_bidi}')
        self.stdout.write(self.style.WARNING(
            f'Skipped (has RTL content, kept controls): {skipped_has_rtl}'
        ))
        if errors > 0:
            self.stdout.write(self.style.ERROR(f'Errors encountered: {errors}'))

    def process_record(self, record, field_name, dry_run, show_details):
        """
        Process a single record.
        Returns: 'cleaned', 'skipped_empty', 'skipped_no_bidi', or 'skipped_has_rtl'
        """
        original_value = getattr(record, field_name)
        
        # Skip if empty
        if not original_value:
            return 'skipped_empty'
        
        # Check if has BiDi controls
        if not self.has_bidi_controls(original_value):
            return 'skipped_no_bidi'
        
        # Check if has RTL script content
        if self.has_rtl_script(original_value):
            if show_details:
                self.stdout.write(
                    self.style.WARNING(
                        f'⚠ Record {record.pk}: Has RTL content, keeping BiDi controls\n'
                        f'  Value: {repr(original_value)}'
                    )
                )
            return 'skipped_has_rtl'
        
        # Strip BiDi controls
        cleaned_value = self.strip_bidi_controls(original_value)
        
        if not dry_run:
            setattr(record, field_name, cleaned_value)
            record.save(update_fields=[field_name])
        
        if show_details or dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Record {record.pk}: Cleaned BiDi controls\n'
                    f'  Before: {repr(original_value)}\n'
                    f'  After:  {repr(cleaned_value)}'
                )
            )
        
        return 'cleaned'

    def has_bidi_controls(self, text):
        """Check if text contains any BiDi control characters"""
        if not text:
            return False
        return any(char in text for char in BIDI_CONTROL_CHARS)

    def has_rtl_script(self, text):
        """
        Check if text contains actual RTL script characters.
        RTL scripts: Arabic, Hebrew, Syriac, Thaana, Nko, etc.
        """
        if not text:
            return False
        
        # Common RTL script Unicode ranges
        rtl_ranges = [
            (0x0590, 0x05FF),  # Hebrew
            (0x0600, 0x06FF),  # Arabic
            (0x0700, 0x074F),  # Syriac
            (0x0750, 0x077F),  # Arabic Supplement
            (0x0780, 0x07BF),  # Thaana
            (0x07C0, 0x07FF),  # Nko
            (0x0840, 0x085F),  # Mandaic
            (0x08A0, 0x08FF),  # Arabic Extended-A
            (0xFB1D, 0xFB4F),  # Hebrew Presentation Forms
            (0xFB50, 0xFDFF),  # Arabic Presentation Forms-A
            (0xFE70, 0xFEFF),  # Arabic Presentation Forms-B
        ]
        
        for char in text:
            code_point = ord(char)
            for start, end in rtl_ranges:
                if start <= code_point <= end:
                    return True
        
        return False

    def strip_bidi_controls(self, text):
        """Remove all Unicode BiDi control characters"""
        if not text:
            return text
        
        for char in BIDI_CONTROL_CHARS:
            text = text.replace(char, '')
        
        return text

