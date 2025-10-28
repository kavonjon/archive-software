"""
Django management command to import languoid data from languoids.json

This command performs a comprehensive import/update of languoid data with:
- Automatic pseudo glottocode generation for nocode entries
- Level-by-level processing (family → subfamily → subsubfamily → language → dialect)
- Smart matching (glottocode primary, name fallback)
- Foreign key relationship resolution
- Parent languoid computation based on hierarchy
- Descendents M2M relationship computation
- Atomic transaction (all-or-nothing)
- Dry-run mode with deep simulation
- Comprehensive conflict detection and validation

Usage:
    python manage.py import_languoids --dry-run          # Simulate without changes
    python manage.py import_languoids                    # Interactive import
    python manage.py import_languoids --no-input         # Auto-confirm import
"""

import json
import os
import re
from decimal import Decimal, InvalidOperation
from collections import defaultdict
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.models import User
from metadata.models import Languoid


class Command(BaseCommand):
    help = 'Import languoid data from languoids.json file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate the import without making database changes',
        )
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Skip confirmation prompt',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed progress information',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.stats = {
            'total_json': 0,
            'created': 0,
            'updated_by_glottocode': 0,
            'updated_by_name': 0,
            'skipped': 0,
            'orphans_in_db': 0,
            'pseudo_codes_generated': 0,
            'circular_references': [],
            'fk_resolution_failures': [],
            'validation_errors': [],
            'conflicts': [],
        }
        self.verbose = False
        self.dry_run = False
        
        # Cache for quick lookups during import
        self.glottocode_cache = {}
        self.name_cache = {}
        
        # Track used glottocodes for pseudo code generation
        self.used_glottocodes = set()

    def handle(self, *args, **options):
        self.verbose = options['verbose']
        self.dry_run = options['dry_run']
        
        mode_str = "DRY RUN" if self.dry_run else "IMPORT"
        self.stdout.write(self.style.SUCCESS(f'\n=== LANGUOID {mode_str} ===\n'))

        # Load JSON data
        json_path = os.path.join(os.path.dirname(__file__), '../../../..', 'languoids.json')
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f'Error: languoids.json not found at {json_path}'))
            return
        except json.JSONDecodeError as e:
            self.stdout.write(self.style.ERROR(f'Error: Invalid JSON file - {e}'))
            return

        self.stats['total_json'] = len(json_data)
        self.stdout.write(f'✓ Loaded {len(json_data)} records from languoids.json\n')

        # Generate pseudo glottocodes for nocode entries
        self.stdout.write('Generating pseudo glottocodes for nocode entries...\n')
        json_data = self.assign_pseudo_glottocodes(json_data)

        # Pre-import validation
        self.stdout.write('Running pre-import validation...\n')
        
        if not self.validate_prerequisites():
            return

        if not self.detect_conflicts(json_data):
            return
        
        # Validate parent relationships for circular references
        if not self.validate_parent_relationships(json_data):
            return

        # Build initial caches from existing DB
        self.build_db_caches()

        # Calculate statistics
        self.calculate_statistics(json_data)

        # Show summary and get confirmation
        if not self.show_summary_and_confirm(options['no_input']):
            self.stdout.write(self.style.WARNING('Import cancelled by user.'))
            return

        # Perform the import
        if self.dry_run:
            self.stdout.write(self.style.WARNING('\n=== DRY RUN MODE - No changes will be made ===\n'))
            success = self.simulate_import(json_data)
        else:
            success = self.perform_import(json_data)

        # Show final report
        self.show_final_report()

        if success:
            if self.dry_run:
                self.stdout.write(self.style.SUCCESS('\n✓ Dry run completed successfully'))
            else:
                self.stdout.write(self.style.SUCCESS('\n✓ Import completed successfully'))
        else:
            self.stdout.write(self.style.ERROR('\n✗ Import failed - no changes made'))

    def assign_pseudo_glottocodes(self, json_data):
        """Assign pseudo glottocodes to records with nocode values"""
        # Build set of used glottocodes from DB
        db_glottocodes = set(Languoid.objects.filter(glottocode__isnull=False).exclude(glottocode='').values_list('glottocode', flat=True))
        self.used_glottocodes.update(db_glottocodes)
        
        # Build set of real glottocodes from JSON (non-nocode entries)
        json_real_glottocodes = {r['glottocode'] for r in json_data if r['glottocode'] and not r['glottocode'].startswith('nocode')}
        self.used_glottocodes.update(json_real_glottocodes)
        
        # Find nocode entries
        nocode_records = [r for r in json_data if r['glottocode'] and r['glottocode'].startswith('nocode')]
        
        if not nocode_records:
            self.stdout.write('✓ No nocode entries found\n')
            return json_data
        
        self.stdout.write(f'🔍 Found {len(nocode_records)} nocode entries - generating pseudo glottocodes...')
        
        # Track old -> new mappings for updating FK references
        code_mappings = {}
        
        # Generate pseudo codes for each nocode entry
        for record in nocode_records:
            old_code = record['glottocode']
            new_code = self.generate_pseudo_glottocode(record['name'])
            
            code_mappings[old_code] = new_code
            record['glottocode'] = new_code
            self.stats['pseudo_codes_generated'] += 1
        
        # Update all FK references
        for record in json_data:
            if record.get('family_languoid') in code_mappings:
                record['family_languoid'] = code_mappings[record['family_languoid']]
            if record.get('pri_subgroup_languoid') in code_mappings:
                record['pri_subgroup_languoid'] = code_mappings[record['pri_subgroup_languoid']]
            if record.get('sec_subgroup_languoid') in code_mappings:
                record['sec_subgroup_languoid'] = code_mappings[record['sec_subgroup_languoid']]
            if record.get('family_id') in code_mappings:
                record['family_id'] = code_mappings[record['family_id']]
            if record.get('pri_subgroup_id') in code_mappings:
                record['pri_subgroup_id'] = code_mappings[record['pri_subgroup_id']]
            if record.get('sec_subgroup_id') in code_mappings:
                record['sec_subgroup_id'] = code_mappings[record['sec_subgroup_id']]
            if record.get('language_id') in code_mappings:
                record['language_id'] = code_mappings[record['language_id']]
        
        self.stdout.write(f'✓ Generated {len(code_mappings)} pseudo glottocodes\n')
        return json_data
    
    def generate_pseudo_glottocode(self, name):
        """Generate a pseudo glottocode from a name (XXXX####)"""
        # Clean the name: remove special characters, lowercase
        clean_name = re.sub(r'[^a-zA-Z]', '', name).lower()
        
        if len(clean_name) == 0:
            clean_name = 'unkn'  # Fallback for edge cases
        
        # Get first 4 characters, repeating last character if needed
        if len(clean_name) < 4:
            prefix = clean_name + clean_name[-1] * (4 - len(clean_name))
        else:
            prefix = clean_name[:4]
        
        # Start enumeration at 0123
        counter = 123
        
        while True:
            pseudo_code = f'{prefix}{counter:04d}'
            
            if pseudo_code not in self.used_glottocodes:
                # Found an unused code
                self.used_glottocodes.add(pseudo_code)
                return pseudo_code
            
            counter += 1
            
            if counter > 9999:
                # Safety check - if we've exhausted 4 digits, something is wrong
                raise Exception(f'Unable to generate pseudo glottocode for "{name}" - exhausted all possibilities')

    def validate_prerequisites(self):
        """Validate that prerequisites are met before import"""
        # Check User ID 1 exists
        try:
            user = User.objects.get(id=1)
            self.stdout.write(f'✓ User ID 1 exists: {user.username}\n')
            return True
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('✗ Error: User ID 1 does not exist'))
            self.stdout.write(self.style.ERROR('  Please create a user with ID 1 first'))
            return False

    def build_db_caches(self):
        """Build caches of existing DB records for quick lookups"""
        for languoid in Languoid.objects.all():
            if languoid.glottocode:
                self.glottocode_cache[languoid.glottocode] = languoid
            self.name_cache.setdefault(languoid.name, []).append(languoid)

    def detect_conflicts(self, json_data):
        """Detect potential conflicts before import"""
        conflicts = []
        
        # Check for duplicate names in DB
        duplicate_names = [name for name, records in self.name_cache.items() if len(records) > 1]
        if duplicate_names:
            conflicts.append(f"Duplicate names in DB: {', '.join(duplicate_names[:10])}")
            if len(duplicate_names) > 10:
                conflicts.append(f"  ... and {len(duplicate_names) - 10} more")

        # Check for glottocode conflicts from name-matches
        for record in json_data:
            json_glottocode = record['glottocode']
            json_name = record['name']
            
            # If glottocode doesn't exist but name does
            if json_glottocode not in self.glottocode_cache and json_name in self.name_cache:
                name_matches = self.name_cache[json_name]
                if len(name_matches) == 1:
                    existing = name_matches[0]
                    # Check if updating this record's glottocode would conflict
                    if json_glottocode in self.glottocode_cache:
                        existing_with_target = self.glottocode_cache[json_glottocode]
                        conflicts.append(
                            f"Name match '{json_name}' (DB: {existing.glottocode}) → "
                            f"wants glottocode {json_glottocode}, but that exists on '{existing_with_target.name}'"
                        )

        if conflicts:
            self.stdout.write(self.style.ERROR('\n✗ CONFLICTS DETECTED:\n'))
            for conflict in conflicts[:20]:  # Show first 20
                self.stdout.write(self.style.ERROR(f'  - {conflict}'))
            if len(conflicts) > 20:
                self.stdout.write(self.style.ERROR(f'  ... and {len(conflicts) - 20} more'))
            
            self.stdout.write(self.style.ERROR('\nImport cannot proceed due to conflicts.'))
            self.stdout.write(self.style.ERROR('Please resolve these issues manually first.\n'))
            self.stats['conflicts'] = conflicts
            return False

        self.stdout.write('✓ No conflicts detected\n')
        return True
    
    def validate_parent_relationships(self, json_data):
        """Validate that parent relationships don't create circular references"""
        self.stdout.write('Validating parent relationships for circular references...\n')
        
        # Build a map of glottocode -> computed parent for each record
        parent_map = {}
        for record in json_data:
            level = record['level']
            glottocode = record['glottocode']
            
            # Compute what the parent would be based on level
            if level == 'family':
                parent_glottocode = None
            elif level == 'subfamily':
                parent_glottocode = record.get('family_id')
            elif level == 'subsubfamily':
                parent_glottocode = record.get('pri_subgroup_id')
            elif level == 'language':
                parent_glottocode = record.get('sec_subgroup_id') or record.get('pri_subgroup_id') or record.get('family_id')
            elif level == 'dialect':
                parent_glottocode = record.get('language_id')
            else:
                parent_glottocode = None
            
            parent_map[glottocode] = {
                'parent': parent_glottocode,
                'name': record['name']
            }
        
        # Check each record for circular references
        circular_refs = []
        for glottocode, info in parent_map.items():
            if self.has_circular_reference_in_map(glottocode, parent_map):
                circular_refs.append(f"{info['name']} (glottocode: {glottocode})")
        
        if circular_refs:
            self.stdout.write(self.style.ERROR('\n✗ CIRCULAR REFERENCES DETECTED:\n'))
            self.stdout.write(self.style.ERROR('   These records reference themselves in their parent chain:\n'))
            for ref in circular_refs[:20]:
                self.stdout.write(self.style.ERROR(f'  - {ref}'))
            if len(circular_refs) > 20:
                self.stdout.write(self.style.ERROR(f'  ... and {len(circular_refs) - 20} more'))
            
            self.stdout.write(self.style.ERROR('\nImport cannot proceed due to circular references.'))
            self.stdout.write(self.style.ERROR('Please fix the parent relationships in the JSON file.\n'))
            self.stats['circular_references'] = circular_refs
            return False
        
        self.stdout.write('✓ No circular references detected\n')
        return True
    
    def has_circular_reference_in_map(self, glottocode, parent_map, visited=None):
        """Check if following parent chain creates a cycle"""
        if visited is None:
            visited = set()
        
        if glottocode in visited:
            return True
        
        if glottocode not in parent_map:
            return False
        
        visited.add(glottocode)
        parent = parent_map[glottocode]['parent']
        
        if parent is None:
            return False
        
        return self.has_circular_reference_in_map(parent, parent_map, visited)

    def calculate_statistics(self, json_data):
        """Calculate what will happen during import"""
        creates = 0
        updates_by_glottocode = 0
        updates_by_name = 0
        
        for record in json_data:
            json_glottocode = record['glottocode']
            json_name = record['name']
            
            if json_glottocode in self.glottocode_cache:
                updates_by_glottocode += 1
            elif json_name in self.name_cache and len(self.name_cache[json_name]) == 1:
                updates_by_name += 1
            else:
                creates += 1
        
        self.stats['created'] = creates
        self.stats['updated_by_glottocode'] = updates_by_glottocode
        self.stats['updated_by_name'] = updates_by_name
        
        # Count orphans (in DB but not in JSON)
        json_glottocodes = {r['glottocode'] for r in json_data}
        json_names = {r['name'] for r in json_data}
        orphans = 0
        for languoid in Languoid.objects.all():
            if languoid.glottocode not in json_glottocodes and languoid.name not in json_names:
                orphans += 1
        self.stats['orphans_in_db'] = orphans

    def show_summary_and_confirm(self, no_input):
        """Show summary statistics and get user confirmation"""
        self.stdout.write('\n' + '='*70)
        self.stdout.write('=== IMPORT SUMMARY ===')
        self.stdout.write('='*70 + '\n')
        
        self.stdout.write(f'Total records in JSON: {self.stats["total_json"]}')
        self.stdout.write(f'New records to create: {self.stats["created"]}')
        self.stdout.write(f'Existing records to update: {self.stats["updated_by_glottocode"] + self.stats["updated_by_name"]}')
        self.stdout.write(f'  - Matched by glottocode: {self.stats["updated_by_glottocode"]}')
        self.stdout.write(f'  - Matched by name: {self.stats["updated_by_name"]}')
        
        if self.stats['orphans_in_db'] > 0:
            self.stdout.write(self.style.WARNING(
                f'\n⚠️  Warning: {self.stats["orphans_in_db"]} records in database will NOT be updated (orphans)'
            ))
        
        self.stdout.write('\n' + '='*70 + '\n')
        
        if self.dry_run or no_input:
            return True
        
        response = input('Proceed with import? [y/N]: ')
        return response.lower() in ['y', 'yes']

    def simulate_import(self, json_data):
        """Simulate the import without making changes (deep dry-run)"""
        self.stdout.write('\n=== Pass 1: Simulating level-by-level import ===\n')
        
        levels = ['family', 'subfamily', 'subsubfamily', 'language', 'dialect']
        
        # Create a simulation cache that includes both existing and newly processed records
        sim_cache = self.glottocode_cache.copy()
        
        for level in levels:
            records = [r for r in json_data if r['level'] == level]
            self.stdout.write(f'\nProcessing {level} level: {len(records)} records')
            
            for i, record in enumerate(records, 1):
                if self.verbose or i % 50 == 0 or i == len(records):
                    self.stdout.write(f'  [{i}/{len(records)}] {record["name"]}', ending='\r')
                
                # Simulate matching
                match_type = self.get_match_type(record)
                
                # Validate field lengths
                validation_errors = self.validate_field_lengths(record)
                if validation_errors:
                    self.stats['validation_errors'].extend(validation_errors)
                
                # Simulate FK resolution using simulation cache
                fk_issues = self.check_fk_resolution_with_cache(record, sim_cache)
                if fk_issues:
                    self.stats['fk_resolution_failures'].extend(fk_issues)
                
                # Add this record to simulation cache so future records can reference it
                if record['glottocode']:
                    # Create a mock object for the simulation cache
                    class MockLanguoid:
                        def __init__(self, glottocode, name):
                            self.glottocode = glottocode
                            self.name = name
                    sim_cache[record['glottocode']] = MockLanguoid(record['glottocode'], record['name'])
            
            self.stdout.write('')  # New line after progress
        
        self.stdout.write('\n=== Pass 2: Simulating descendents computation ===')
        self.stdout.write(f'Would compute descendents for all {len(json_data)} languoids\n')
        
        return len(self.stats['fk_resolution_failures']) == 0 and len(self.stats['validation_errors']) == 0

    def perform_import(self, json_data):
        """Perform the actual import with transaction protection"""
        try:
            with transaction.atomic():
                self.stdout.write('\n=== Pass 1: Importing level-by-level ===\n')
                
                levels = ['family', 'subfamily', 'subsubfamily', 'language', 'dialect']
                
                # Get modified_by user
                user = User.objects.get(id=1)
                modified_by = user.username
                
                for level in levels:
                    records = [r for r in json_data if r['level'] == level]
                    self.stdout.write(f'\nProcessing {level} level: {len(records)} records')
                    
                    for i, record in enumerate(records, 1):
                        self.stdout.write(f'  [{i}/{len(records)}] {record["name"]}', ending='\r')
                        
                        # Match or create
                        languoid, match_type = self.match_or_create_languoid(record)
                        
                        # Update fields
                        self.update_languoid_fields(languoid, record, match_type, modified_by)
                        
                        # Resolve FK relationships
                        self.resolve_fk_relationships(languoid, record)
                        
                        # Compute parent_languoid
                        languoid.parent_languoid = self.compute_parent_languoid(record)
                        
                        # Save
                        languoid.save()
                        
                        # Update cache
                        if languoid.glottocode:
                            self.glottocode_cache[languoid.glottocode] = languoid
                    
                    self.stdout.write('')  # New line after progress
                
                # Pass 2: Compute descendents
                self.stdout.write('\n=== Pass 2: Computing descendents relationships ===\n')
                all_languoids = list(Languoid.objects.all())
                
                for i, languoid in enumerate(all_languoids, 1):
                    self.stdout.write(f'  [{i}/{len(all_languoids)}] {languoid.name}', ending='\r')
                    
                    descendents = self.get_all_descendents(languoid)
                    languoid.descendents.set(descendents)
                
                self.stdout.write('')  # New line
                
                return True
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n✗ Error during import: {e}'))
            self.stdout.write(self.style.ERROR('Transaction rolled back - no changes made'))
            import traceback
            traceback.print_exc()
            return False

    def get_match_type(self, record):
        """Determine how this record would be matched"""
        json_glottocode = record['glottocode']
        json_name = record['name']
        
        if json_glottocode in self.glottocode_cache:
            return 'glottocode'
        elif json_name in self.name_cache and len(self.name_cache[json_name]) == 1:
            return 'name'
        else:
            return 'new'

    def match_or_create_languoid(self, record):
        """Match existing languoid or create new one"""
        json_glottocode = record['glottocode']
        json_name = record['name']
        
        # Try glottocode match first
        if json_glottocode in self.glottocode_cache:
            return self.glottocode_cache[json_glottocode], 'glottocode'
        
        # Try name match
        if json_name in self.name_cache:
            name_matches = self.name_cache[json_name]
            if len(name_matches) == 1:
                self.stats['updated_by_name'] += 1
                return name_matches[0], 'name'
        
        # Create new
        self.stats['created'] += 1
        return Languoid(), 'new'

    def update_languoid_fields(self, languoid, record, match_type, modified_by):
        """Update languoid fields from JSON record"""
        # Fields that are always updated (unless protected by match type)
        if match_type != 'glottocode':
            languoid.glottocode = record['glottocode']
        
        if match_type != 'name':
            languoid.name = record['name']
        
        # Always update these fields
        languoid.iso = record['iso'] or ''
        languoid.name_abbrev = record['name_abbrev'] or ''
        languoid.name_for_glottocode_on_glottolog = record['name_for_glottocode_on_glottolog'] or ''
        
        # Level fields
        json_level = record['level']
        languoid.level_nal = json_level
        
        level_glottolog_mapping = {
            'family': 'family',
            'subfamily': 'family',
            'subsubfamily': 'family',
            'language': 'language',
            'dialect': 'dialect',
        }
        languoid.level_glottolog = level_glottolog_mapping[json_level]
        
        # Skip text fields (family, family_id, etc.) - only use FKs
        # These will be derived from FK relationships later
        
        # Other fields
        languoid.alt_names = record['alt_names'] if record['alt_names'] else []
        languoid.region = record['region'] or ''
        
        # Decimal fields
        try:
            languoid.longitude = Decimal(str(record['longitude'])) if record['longitude'] is not None else None
        except (InvalidOperation, ValueError):
            languoid.longitude = None
        
        try:
            languoid.latitude = Decimal(str(record['latitude'])) if record['latitude'] is not None else None
        except (InvalidOperation, ValueError):
            languoid.latitude = None
        
        languoid.tribes = record['tribes'] or ''
        languoid.notes = record['notes'] or ''
        languoid.modified_by = modified_by

    def resolve_fk_relationships(self, languoid, record):
        """Resolve foreign key relationships"""
        # family_languoid
        if record['family_languoid']:
            try:
                languoid.family_languoid = self.glottocode_cache[record['family_languoid']]
            except KeyError:
                raise Exception(f"FK resolution failed: family_languoid '{record['family_languoid']}' not found for {record['name']}")
        else:
            languoid.family_languoid = None
        
        # pri_subgroup_languoid
        if record['pri_subgroup_languoid']:
            try:
                languoid.pri_subgroup_languoid = self.glottocode_cache[record['pri_subgroup_languoid']]
            except KeyError:
                raise Exception(f"FK resolution failed: pri_subgroup_languoid '{record['pri_subgroup_languoid']}' not found for {record['name']}")
        else:
            languoid.pri_subgroup_languoid = None
        
        # sec_subgroup_languoid
        if record['sec_subgroup_languoid']:
            try:
                languoid.sec_subgroup_languoid = self.glottocode_cache[record['sec_subgroup_languoid']]
            except KeyError:
                raise Exception(f"FK resolution failed: sec_subgroup_languoid '{record['sec_subgroup_languoid']}' not found for {record['name']}")
        else:
            languoid.sec_subgroup_languoid = None

    def compute_parent_languoid(self, record):
        """Compute parent_languoid based on level and hierarchy"""
        level = record['level']
        
        if level == 'family':
            return None
        
        elif level == 'subfamily':
            # Link to family
            if record['family_id']:
                return self.glottocode_cache.get(record['family_id'])
            return None
        
        elif level == 'subsubfamily':
            # Link to subfamily (pri_subgroup)
            if record['pri_subgroup_id']:
                return self.glottocode_cache.get(record['pri_subgroup_id'])
            return None
        
        elif level == 'language':
            # Link to subsubfamily > subfamily > family (first available)
            if record['sec_subgroup_id']:
                parent = self.glottocode_cache.get(record['sec_subgroup_id'])
                if parent:
                    return parent
            if record['pri_subgroup_id']:
                parent = self.glottocode_cache.get(record['pri_subgroup_id'])
                if parent:
                    return parent
            if record['family_id']:
                return self.glottocode_cache.get(record['family_id'])
            return None
        
        elif level == 'dialect':
            # Link to parent language using language_id
            if record['language_id']:
                return self.glottocode_cache.get(record['language_id'])
            return None
        
        return None

    def check_fk_resolution(self, record):
        """Check if FK resolution would succeed (for dry-run)"""
        return self.check_fk_resolution_with_cache(record, self.glottocode_cache)
    
    def validate_field_lengths(self, record):
        """Validate that field values don't exceed max_length constraints"""
        errors = []
        
        # Check 8-character fields
        fields_max_8 = [
            ('glottocode', record.get('glottocode', '')),
            ('family_id', record.get('family_id', '')),
            ('pri_subgroup_id', record.get('pri_subgroup_id', '')),
            ('sec_subgroup_id', record.get('sec_subgroup_id', '')),
        ]
        
        for field_name, value in fields_max_8:
            if value and len(value) > 8:
                errors.append(
                    f"{record['name']}: {field_name} '{value}' exceeds max length of 8 characters (length: {len(value)})"
                )
        
        # Check 100-character field (iso)
        if record.get('iso') and len(record['iso']) > 100:
            errors.append(
                f"{record['name']}: iso '{record['iso']}' exceeds max length of 100 characters (length: {len(record['iso'])})"
            )
        
        # Check 255-character fields
        fields_max_255 = [
            ('name', record.get('name', '')),
            ('name_abbrev', record.get('name_abbrev', '')),
            ('name_for_glottocode_on_glottolog', record.get('name_for_glottocode_on_glottolog', '')),
            ('family', record.get('family', '')),
            ('family_abbrev', record.get('family_abbrev', '')),
            ('pri_subgroup', record.get('pri_subgroup', '')),
            ('pri_subgroup_abbrev', record.get('pri_subgroup_abbrev', '')),
            ('sec_subgroup', record.get('sec_subgroup', '')),
            ('sec_subgroup_abbrev', record.get('sec_subgroup_abbrev', '')),
            ('region', record.get('region', '')),
            ('notes', record.get('notes', '')),
        ]
        
        for field_name, value in fields_max_255:
            if value and len(value) > 255:
                errors.append(
                    f"{record['name']}: {field_name} exceeds max length of 255 characters (length: {len(value)})"
                )
        
        # Note: tribes is now TextField (unlimited), so no validation needed
        
        return errors
    
    def check_fk_resolution_with_cache(self, record, cache):
        """Check if FK resolution would succeed using provided cache"""
        issues = []
        
        if record['family_languoid'] and record['family_languoid'] not in cache:
            issues.append(f"{record['name']}: family_languoid '{record['family_languoid']}' not found")
        
        if record['pri_subgroup_languoid'] and record['pri_subgroup_languoid'] not in cache:
            issues.append(f"{record['name']}: pri_subgroup_languoid '{record['pri_subgroup_languoid']}' not found")
        
        if record['sec_subgroup_languoid'] and record['sec_subgroup_languoid'] not in cache:
            issues.append(f"{record['name']}: sec_subgroup_languoid '{record['sec_subgroup_languoid']}' not found")
        
        return issues

    def get_all_descendents(self, languoid, visited=None):
        """Recursively get all descendents at all levels, with circular reference protection"""
        if visited is None:
            visited = set()
        
        # Prevent circular references
        if languoid.id in visited:
            return []
        
        visited.add(languoid.id)
        descendents = []
        
        # Get direct children
        children = Languoid.objects.filter(parent_languoid=languoid)
        
        for child in children:
            # Skip if this would create a circular reference
            if child.id not in visited:
                descendents.append(child)
                # Recursively get child's descendents
                descendents.extend(self.get_all_descendents(child, visited))
        
        return descendents

    def has_circular_parent_reference(self, languoid):
        """Check if a languoid has a circular reference in its parent chain"""
        visited = set()
        current = languoid
        
        while current is not None:
            if current.id in visited:
                # Found a cycle
                return True
            visited.add(current.id)
            current = current.parent_languoid
        
        return False

    def show_final_report(self):
        """Show final report of import results"""
        self.stdout.write('\n' + '='*70)
        self.stdout.write('=== FINAL REPORT ===')
        self.stdout.write('='*70 + '\n')
        
        self.stdout.write(f'Total records processed: {self.stats["total_json"]}')
        self.stdout.write(f'Pseudo glottocodes generated: {self.stats["pseudo_codes_generated"]}')
        self.stdout.write(f'Records created: {self.stats["created"]}')
        self.stdout.write(f'Records updated (by glottocode): {self.stats["updated_by_glottocode"]}')
        self.stdout.write(f'Records updated (by name): {self.stats["updated_by_name"]}')
        self.stdout.write(f'Orphans in DB (not updated): {self.stats["orphans_in_db"]}')
        
        if self.stats['circular_references']:
            self.stdout.write(self.style.WARNING(f'\n⚠️  Circular References Detected: {len(self.stats["circular_references"])}'))
            self.stdout.write(self.style.WARNING('   (Descendents not computed for these records)'))
            for ref in self.stats['circular_references'][:10]:
                self.stdout.write(self.style.WARNING(f'  - {ref}'))
            if len(self.stats['circular_references']) > 10:
                self.stdout.write(self.style.WARNING(f'  ... and {len(self.stats["circular_references"]) - 10} more'))
        
        if self.stats['fk_resolution_failures']:
            self.stdout.write(self.style.ERROR(f'\n⚠️  FK Resolution Failures: {len(self.stats["fk_resolution_failures"])}'))
            for issue in self.stats['fk_resolution_failures'][:10]:
                self.stdout.write(self.style.ERROR(f'  - {issue}'))
            if len(self.stats['fk_resolution_failures']) > 10:
                self.stdout.write(self.style.ERROR(f'  ... and {len(self.stats["fk_resolution_failures"]) - 10} more'))
        
        if self.stats['validation_errors']:
            self.stdout.write(self.style.ERROR(f'\n⚠️  Validation Errors: {len(self.stats["validation_errors"])}'))
            for error in self.stats['validation_errors'][:10]:
                self.stdout.write(self.style.ERROR(f'  - {error}'))
        
        self.stdout.write('\n' + '='*70 + '\n')

