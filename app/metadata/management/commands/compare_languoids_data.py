"""
Django management command to compare database languoids with languoids.json file.

Analyzes differences between current database and the JSON import file:
- Database glottocodes missing from JSON
- JSON glottocodes missing from database
- Matching glottocodes with field differences

Usage:
    python manage.py compare_languoids_data
    python manage.py compare_languoids_data --json-file /path/to/languoids.json
"""

import json
from django.core.management.base import BaseCommand
from metadata.models import Languoid


class Command(BaseCommand):
    help = 'Compare database languoids with languoids.json file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--json-file',
            type=str,
            default='languoids.json',
            help='Path to languoids JSON file (default: languoids.json in current directory)',
        )

    def handle(self, *args, **options):
        json_file = options['json_file']
        
        self.stdout.write(self.style.SUCCESS('Starting languoids comparison...\n'))
        
        # Load JSON data
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            self.stdout.write(f'✓ Loaded {len(json_data)} records from {json_file}\n')
        except FileNotFoundError:
            self.stdout.write(
                self.style.ERROR(f'Error: File "{json_file}" not found')
            )
            return
        except json.JSONDecodeError as e:
            self.stdout.write(
                self.style.ERROR(f'Error: Invalid JSON in "{json_file}": {e}')
            )
            return
        
        # Extract glottocodes from JSON (filter out empty ones)
        json_glottocodes = {
            record['glottocode'] 
            for record in json_data 
            if record.get('glottocode')
        }
        self.stdout.write(f'✓ Found {len(json_glottocodes)} unique glottocodes in JSON\n')
        
        # Get all database languoids with glottocodes
        db_languoids = Languoid.objects.exclude(glottocode='').exclude(glottocode__isnull=True)
        db_count = db_languoids.count()
        db_glottocodes = set(db_languoids.values_list('glottocode', flat=True))
        
        self.stdout.write(f'✓ Found {db_count} languoids with glottocodes in database\n')
        self.stdout.write(f'✓ Found {len(db_glottocodes)} unique glottocodes in database\n')
        
        # Compare
        self.stdout.write('\n' + '='*70)
        self.stdout.write('\n=== COMPARISON RESULTS ===\n')
        self.stdout.write('='*70 + '\n')
        
        # 1. Database glottocodes NOT in JSON
        db_not_in_json = db_glottocodes - json_glottocodes
        
        self.stdout.write('\n' + self.style.WARNING(
            f'1. DATABASE GLOTTOCODES MISSING FROM JSON: {len(db_not_in_json)}'
        ))
        
        if db_not_in_json:
            self.stdout.write(self.style.WARNING(
                f'\n   These {len(db_not_in_json)} glottocodes exist in your database but NOT in the JSON file:'
            ))
            self.stdout.write(self.style.WARNING(
                '   (This means importing the JSON would NOT update these records)\n'
            ))
            
            # Check for name-based matches
            self.stdout.write('\n   Checking for name-based matches...\n')
            
            name_matches = []
            no_name_match = []
            
            for glottocode in sorted(db_not_in_json):
                languoid = Languoid.objects.get(glottocode=glottocode)
                
                # Look for matching name in JSON
                json_match = None
                for record in json_data:
                    if record.get('name', '').strip().lower() == languoid.name.strip().lower():
                        json_match = record
                        break
                
                if json_match:
                    name_matches.append({
                        'db_glottocode': glottocode,
                        'db_name': languoid.name,
                        'db_level': languoid.level_nal,
                        'json_glottocode': json_match.get('glottocode', 'N/A'),
                        'json_name': json_match.get('name', 'N/A'),
                        'json_level': json_match.get('level', 'N/A'),
                    })
                else:
                    no_name_match.append({
                        'glottocode': glottocode,
                        'name': languoid.name,
                        'level': languoid.level_nal,
                    })
            
            # Report name matches
            if name_matches:
                self.stdout.write(self.style.SUCCESS(
                    f'\n   ✓ Found {len(name_matches)} NAME MATCHES (same name, different glottocode):\n'
                ))
                for match in name_matches:
                    self.stdout.write(
                        f'   - Name: "{match["db_name"]}" (level: {match["db_level"]})\n'
                        f'     DB glottocode:   {match["db_glottocode"]}\n'
                        f'     JSON glottocode: {match["json_glottocode"]}\n'
                    )
            else:
                self.stdout.write('   (No name-based matches found)\n')
            
            # Report no matches
            if no_name_match:
                self.stdout.write(self.style.WARNING(
                    f'\n   ⚠ {len(no_name_match)} records with NO MATCH (not in JSON by glottocode or name):\n'
                ))
                
                # Check for associations with other models
                self.stdout.write('\n   Checking for associations with other models...\n')
                
                orphans_with_associations = []
                orphans_without_associations = []
                
                for record in no_name_match:
                    languoid = Languoid.objects.get(glottocode=record['glottocode'])
                    
                    # Check associations
                    associations = {
                        'items_via_dialectinstance': languoid.language_dialectinstances.count(),
                        'collaborators_native': languoid.collaborator_native_languages.count(),
                        'collaborators_other': languoid.collaborator_other_languages.count(),
                    }
                    
                    total_associations = sum(associations.values())
                    
                    if total_associations > 0:
                        orphans_with_associations.append({
                            'record': record,
                            'associations': associations,
                            'total': total_associations
                        })
                    else:
                        orphans_without_associations.append(record)
                
                # Report orphans with associations
                if orphans_with_associations:
                    self.stdout.write(self.style.ERROR(
                        f'\n   ❌ CRITICAL: {len(orphans_with_associations)} orphans ARE BEING USED by other models!\n'
                    ))
                    for orphan in orphans_with_associations:
                        rec = orphan['record']
                        assoc = orphan['associations']
                        self.stdout.write(
                            f'\n   - {rec["glottocode"]}: {rec["name"]} (level: {rec["level"]})'
                        )
                        self.stdout.write(f'     Total associations: {orphan["total"]}')
                        if assoc['items_via_dialectinstance'] > 0:
                            self.stdout.write(f'       • Items: {assoc["items_via_dialectinstance"]}')
                        if assoc['collaborators_native'] > 0:
                            self.stdout.write(f'       • Collaborators (native language): {assoc["collaborators_native"]}')
                        if assoc['collaborators_other'] > 0:
                            self.stdout.write(f'       • Collaborators (other language): {assoc["collaborators_other"]}')
                
                # Report orphans without associations
                if orphans_without_associations:
                    self.stdout.write(self.style.WARNING(
                        f'\n   ⚠ {len(orphans_without_associations)} orphans with NO associations (safe to ignore):\n'
                    ))
                    
                    # Separate fake codes from real codes
                    fake_codes = [r for r in orphans_without_associations if r['glottocode'].startswith('fake')]
                    real_codes = [r for r in orphans_without_associations if not r['glottocode'].startswith('fake')]
                    
                    if real_codes:
                        self.stdout.write(f'\n   Real glottocodes ({len(real_codes)}):\n')
                        for record in real_codes:
                            self.stdout.write(
                                f'   - {record["glottocode"]}: {record["name"]} (level: {record["level"]})'
                            )
                    
                    if fake_codes:
                        self.stdout.write(f'\n   Fake glottocodes ({len(fake_codes)}):\n')
                        for record in fake_codes:
                            self.stdout.write(
                                f'   - {record["glottocode"]}: {record["name"]} (level: {record["level"]})'
                            )
        else:
            self.stdout.write(self.style.SUCCESS(
                '\n   ✓ All database glottocodes are present in JSON file'
            ))
        
        # 2. JSON glottocodes NOT in database
        json_not_in_db = json_glottocodes - db_glottocodes
        
        self.stdout.write('\n\n' + self.style.SUCCESS(
            f'2. JSON GLOTTOCODES MISSING FROM DATABASE: {len(json_not_in_db)}'
        ))
        
        if json_not_in_db:
            self.stdout.write(
                f'\n   These {len(json_not_in_db)} glottocodes exist in JSON but NOT in your database:'
            )
            self.stdout.write(
                '   (These would be NEW records if you import)\n'
            )
            
            # Show sample (first 20)
            sample = sorted(json_not_in_db)[:20]
            for glottocode in sample:
                json_record = next(r for r in json_data if r.get('glottocode') == glottocode)
                self.stdout.write(
                    f'   - {glottocode}: {json_record.get("name", "N/A")} '
                    f'(level: {json_record.get("level", "N/A")})'
                )
            
            if len(json_not_in_db) > 20:
                self.stdout.write(f'   ... and {len(json_not_in_db) - 20} more')
        else:
            self.stdout.write(
                '\n   All JSON glottocodes already exist in database'
            )
        
        # 3. Matching glottocodes (potential updates)
        matching = db_glottocodes & json_glottocodes
        
        self.stdout.write('\n\n' + self.style.SUCCESS(
            f'3. MATCHING GLOTTOCODES (in both): {len(matching)}'
        ))
        self.stdout.write(
            f'\n   These records exist in both database and JSON'
        )
        self.stdout.write(
            '   (Will need to check for field differences)\n'
        )
        
        # Summary
        self.stdout.write('\n' + '='*70)
        self.stdout.write('\n=== SUMMARY ===\n')
        self.stdout.write('='*70)
        self.stdout.write(f'\nDatabase records: {db_count}')
        self.stdout.write(f'JSON records: {len(json_data)}')
        self.stdout.write(f'\nDatabase unique glottocodes: {len(db_glottocodes)}')
        self.stdout.write(f'JSON unique glottocodes: {len(json_glottocodes)}')
        self.stdout.write(f'\nDatabase-only glottocodes: {len(db_not_in_json)}')
        if db_not_in_json:
            self.stdout.write(f'  - Found by name match: {len(name_matches)}')
            self.stdout.write(f'  - No match at all: {len(no_name_match)}')
        self.stdout.write(f'JSON-only: {len(json_not_in_db)}')
        self.stdout.write(f'Both (matching glottocodes): {len(matching)}')
        
        # Answer the specific question
        self.stdout.write('\n\n' + '='*70)
        if db_not_in_json:
            self.stdout.write(self.style.WARNING(
                f'\n⚠️  ANSWER: YES, there are {len(db_not_in_json)} database records with glottocodes '
                f'that are MISSING from the JSON file.'
            ))
            if name_matches:
                self.stdout.write(self.style.SUCCESS(
                    f'\n✓ However, {len(name_matches)} of these CAN be matched by name!'
                ))
                self.stdout.write(self.style.SUCCESS(
                    '\n  These likely have incorrect/placeholder glottocodes in the database.'
                ))
            if no_name_match:
                self.stdout.write(self.style.WARNING(
                    f'\n⚠️  {len(no_name_match)} records have NO match (neither glottocode nor name).'
                ))
                self.stdout.write(self.style.WARNING(
                    '\n  These are truly unique to your database.'
                ))
        else:
            self.stdout.write(self.style.SUCCESS(
                '\n✓ ANSWER: NO, all database glottocodes are present in the JSON file.'
            ))
            self.stdout.write(self.style.SUCCESS(
                '\nEvery database record would be matched during import.'
            ))
        self.stdout.write('\n' + '='*70 + '\n')

