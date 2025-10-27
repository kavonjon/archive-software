"""
Django management command to migrate alt_name (comma-separated string) to alt_names (JSON list).

Handles three scenarios:
1. alt_names is empty: automatically parse alt_name and populate alt_names
2. alt_names matches parsed alt_name: no change needed (skip)
3. alt_names differs from parsed alt_name: prompt user to choose or manually enter

Usage:
    python manage.py migrate_alt_names
    python manage.py migrate_alt_names --dry-run  # See what would change without applying
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from metadata.models import Languoid


class Command(BaseCommand):
    help = 'Migrate alt_name (comma-separated) to alt_names (JSON list) with conflict resolution'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        
        self.stdout.write(self.style.SUCCESS('Starting alt_name to alt_names migration...'))
        
        # Get all languoids
        languoids = Languoid.objects.all()
        total_count = languoids.count()
        
        self.stdout.write(f'Found {total_count} languoid records')
        
        # Counters for reporting
        auto_migrated = 0
        skipped_empty = 0
        skipped_matching = 0
        conflicts_resolved = 0
        errors = 0
        
        for idx, languoid in enumerate(languoids, 1):
            try:
                result = self.process_languoid(languoid, dry_run)
                
                if result == 'auto_migrated':
                    auto_migrated += 1
                elif result == 'skipped_empty':
                    skipped_empty += 1
                elif result == 'skipped_matching':
                    skipped_matching += 1
                elif result == 'conflict_resolved':
                    conflicts_resolved += 1
                
                # Progress indicator every 100 records
                if idx % 100 == 0:
                    self.stdout.write(f'Processed {idx}/{total_count} records...')
                    
            except Exception as e:
                errors += 1
                self.stdout.write(
                    self.style.ERROR(f'Error processing languoid {languoid.id} ({languoid.name}): {e}')
                )
        
        # Final report
        self.stdout.write(self.style.SUCCESS('\n=== Migration Complete ==='))
        self.stdout.write(f'Total records: {total_count}')
        self.stdout.write(f'Auto-migrated (alt_names was empty): {auto_migrated}')
        self.stdout.write(f'Skipped (both alt_name and alt_names empty): {skipped_empty}')
        self.stdout.write(f'Skipped (values already match): {skipped_matching}')
        self.stdout.write(f'Conflicts resolved interactively: {conflicts_resolved}')
        if errors > 0:
            self.stdout.write(self.style.ERROR(f'Errors encountered: {errors}'))

    def process_languoid(self, languoid, dry_run):
        """
        Process a single languoid record.
        Returns: 'auto_migrated', 'skipped_empty', 'skipped_matching', or 'conflict_resolved'
        """
        alt_name = (languoid.alt_name or '').strip()
        alt_names = languoid.alt_names or []
        
        # Parse alt_name into a list
        parsed_alt_names = self.parse_alt_name(alt_name)
        
        # Scenario 1: Both empty - skip
        if not parsed_alt_names and not alt_names:
            return 'skipped_empty'
        
        # Scenario 2: alt_names is empty but alt_name has data - auto migrate
        if not alt_names and parsed_alt_names:
            if not dry_run:
                languoid.alt_names = parsed_alt_names
                languoid.save(update_fields=['alt_names'])
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Auto-migrated: {languoid.name} (ID: {languoid.id}) '
                    f'→ {parsed_alt_names}'
                )
            )
            return 'auto_migrated'
        
        # Scenario 3: alt_names exists - check if it matches
        if alt_names and parsed_alt_names:
            # Normalize both lists for comparison (strip whitespace, case-insensitive)
            normalized_alt_names = [name.strip() for name in alt_names]
            normalized_parsed = [name.strip() for name in parsed_alt_names]
            
            if set(normalized_alt_names) == set(normalized_parsed):
                # They match - no action needed
                return 'skipped_matching'
            else:
                # Conflict - prompt user
                if dry_run:
                    self.stdout.write(
                        self.style.WARNING(
                            f'⚠ Conflict found (DRY RUN): {languoid.name} (ID: {languoid.id})\n'
                            f'  alt_name parsed: {parsed_alt_names}\n'
                            f'  alt_names current: {alt_names}'
                        )
                    )
                    return 'conflict_resolved'
                else:
                    new_value = self.resolve_conflict(languoid, parsed_alt_names, alt_names)
                    if new_value is not None:
                        languoid.alt_names = new_value
                        languoid.save(update_fields=['alt_names'])
                        self.stdout.write(
                            self.style.SUCCESS(f'✓ Updated: {languoid.name} → {new_value}')
                        )
                    return 'conflict_resolved'
        
        # Scenario 4: alt_names exists but alt_name is empty - keep alt_names
        if alt_names and not parsed_alt_names:
            return 'skipped_matching'
        
        return 'skipped_empty'

    def parse_alt_name(self, alt_name):
        """
        Parse comma-separated alt_name string into a list.
        Handles various separators and cleans up whitespace.
        """
        if not alt_name:
            return []
        
        # Split by comma, semicolon, or pipe
        names = []
        for separator in [',', ';', '|']:
            if separator in alt_name:
                names = alt_name.split(separator)
                break
        
        # If no separator found, treat as single name
        if not names:
            names = [alt_name]
        
        # Clean up whitespace and filter empty strings
        names = [name.strip() for name in names if name.strip()]
        
        return names

    def resolve_conflict(self, languoid, parsed_alt_names, current_alt_names):
        """
        Interactively resolve conflict between parsed alt_name and existing alt_names.
        Returns the chosen list, or None if user wants to skip.
        """
        self.stdout.write('\n' + '='*70)
        self.stdout.write(self.style.WARNING(f'CONFLICT: {languoid.name} (ID: {languoid.id})'))
        self.stdout.write('='*70)
        self.stdout.write(f'Glottocode: {languoid.glottocode}')
        self.stdout.write(f'ISO: {languoid.iso}')
        self.stdout.write(f'\nalt_name (raw): "{languoid.alt_name}"')
        self.stdout.write(f'  → Parsed as: {parsed_alt_names}')
        self.stdout.write(f'\nalt_names (current): {current_alt_names}')
        self.stdout.write('\nOptions:')
        self.stdout.write('  1) Use parsed alt_name value')
        self.stdout.write('  2) Keep current alt_names value')
        self.stdout.write('  3) Manually enter new value (comma-separated)')
        self.stdout.write('  4) Skip this record')
        
        while True:
            choice = input('\nSelect option (1-4): ').strip()
            
            if choice == '1':
                return parsed_alt_names
            elif choice == '2':
                return current_alt_names
            elif choice == '3':
                manual_input = input('Enter comma-separated names: ').strip()
                if manual_input:
                    manual_list = self.parse_alt_name(manual_input)
                    self.stdout.write(f'Will save as: {manual_list}')
                    confirm = input('Confirm? (y/n): ').strip().lower()
                    if confirm == 'y':
                        return manual_list
                    else:
                        continue
                else:
                    self.stdout.write(self.style.WARNING('Empty input, try again'))
                    continue
            elif choice == '4':
                self.stdout.write(self.style.WARNING('Skipping this record'))
                return None
            else:
                self.stdout.write(self.style.ERROR('Invalid choice. Please enter 1, 2, 3, or 4.'))

