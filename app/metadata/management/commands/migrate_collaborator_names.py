"""
Django management command to standardize collaborator name fields.

This command processes collaborators one-by-one, applying automatic fixes where possible
and prompting for user input when ambiguous. After processing, it rebuilds full_name
in the standard format: first_names "nickname" last_names name_suffix

Usage:
    python manage.py migrate_collaborator_names
    python manage.py migrate_collaborator_names --start-pk 100
    python manage.py migrate_collaborator_names --start-pk 100 --end-pk 200
    python manage.py migrate_collaborator_names --dry-run
    python manage.py migrate_collaborator_names --no-pause
"""

import re
from django.core.management.base import BaseCommand
from metadata.models import Collaborator


class Command(BaseCommand):
    help = 'Migrate and standardize collaborator name fields'

    def __init__(self):
        super().__init__()
        self.stats = {
            'total_processed': 0,
            'auto_fixed': 0,
            'rule_1a': 0,  # Suffix in last_names
            'rule_2': 0,   # Suffix in first_names
            'rule_3': 0,   # Middle name reconciliation
            'rule_4': 0,   # Parentheticals
            'rule_5': 0,   # Comma format
            'rule_6': 0,   # Rebuild full_name from components
            'rule_8': 0,   # Whitespace normalization
            'rule_9': 0,   # Extract suffix from full_name
            'rule_10': 0,  # Single name in wrong field
            'prompted': 0,
            'skipped': 0,
            'errors': 0,
        }

    def add_arguments(self, parser):
        parser.add_argument(
            '--start-pk',
            type=int,
            default=1,
            help='Start processing from this PK (default: 1)',
        )
        parser.add_argument(
            '--end-pk',
            type=int,
            default=None,
            help='Stop processing at this PK (default: process all)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would happen without saving changes',
        )
        parser.add_argument(
            '--no-pause',
            action='store_true',
            help='Skip pause after each auto-fix (auto-continue)',
        )

    def handle(self, *args, **options):
        start_pk = options['start_pk']
        end_pk = options['end_pk']
        dry_run = options['dry_run']
        no_pause = options['no_pause']

        # Build queryset
        queryset = Collaborator.objects.filter(pk__gte=start_pk).order_by('pk')
        if end_pk:
            queryset = queryset.filter(pk__lte=end_pk)

        total_count = queryset.count()

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Collaborator Name Migration Tool'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(f'Starting from PK: {start_pk}')
        if end_pk:
            self.stdout.write(f'Ending at PK: {end_pk}')
        self.stdout.write(f'Total collaborators to process: {total_count}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        self.stdout.write('')

        # Process each collaborator
        for collaborator in queryset:
            try:
                result = self.process_collaborator(collaborator, dry_run)
                
                # Pause after each auto-fix (unless --no-pause)
                if result == 'auto' and not no_pause:
                    response = input('Press Enter to continue, or "q" to quit: ').strip().lower()
                    if response == 'q':
                        self.stdout.write(self.style.WARNING('\nQuitting...'))
                        break
                    self.stdout.write('')
                
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('\n\nInterrupted by user. Exiting...'))
                break
            except Exception as e:
                self.stats['errors'] += 1
                import traceback
                self.stdout.write(self.style.ERROR(f'[ERROR] PK {collaborator.pk}: {type(e).__name__}: {str(e)}'))
                if self.verbosity >= 2:
                    self.stdout.write(traceback.format_exc())

        # Print final statistics
        self.print_final_stats()

    def process_collaborator(self, collab, dry_run):
        """
        Process a single collaborator. Returns 'auto', 'prompt', 'skip', or 'error'.
        """
        self.stats['total_processed'] += 1
        
        # Store original values for final comparison
        original_full_name = collab.full_name
        original_first_names = collab.first_names
        original_last_names = collab.last_names
        original_name_suffix = collab.name_suffix
        original_nickname = collab.nickname

        # Check if we need to process this collaborator
        needs_processing, reason = self.needs_processing(collab)
        
        if not needs_processing:
            self.stats['skipped'] += 1
            self.print_skip(collab, reason)
            return 'skip'

        # Apply rules iteratively until "already correct" or recursion limit
        rules_applied = []
        max_iterations = 10  # Safety limit (more than number of rules)
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            
            # Capture current state before applying rule
            current_full_name = collab.full_name
            current_first_names = collab.first_names
            current_last_names = collab.last_names
            current_name_suffix = collab.name_suffix
            current_nickname = collab.nickname
            
            # Try to apply one rule
            auto_result = self.try_auto_fix(collab)
            
            if auto_result:
                # Rule was applied
                rule_applied, changes = auto_result
                rules_applied.append((
                    rule_applied, 
                    changes,
                    current_full_name,
                    current_first_names,
                    current_last_names,
                    current_name_suffix,
                    current_nickname
                ))
                self.stats['auto_fixed'] += 1
                self.stats[rule_applied] += 1
                
                # Check if now "already correct"
                needs_processing, reason = self.needs_processing(collab)
                if not needs_processing:
                    # Success! Data is now correct
                    break
            else:
                # No rule matched, but still needs processing → interactive prompt
                break
        
        # Check if we hit the recursion limit
        if iteration >= max_iterations and needs_processing:
            # Too many iterations, prompt user
            self.stdout.write(self.style.WARNING('=' * 70))
            self.stdout.write(self.style.WARNING(f'[WARNING] PK {collab.pk}: Recursion limit reached'))
            self.stdout.write(self.style.WARNING(f'Applied {len(rules_applied)} rules but data still needs processing'))
            self.stdout.write(self.style.WARNING('=' * 70))
            
            # Print all the changes that were made
            for rule_applied, changes, prev_full, prev_first, prev_last, prev_suffix, prev_nick in rules_applied:
                self.print_auto_fix(collab, rule_applied, changes, prev_full, 
                                  prev_first, prev_last, prev_suffix, prev_nick)
            
            self.stdout.write(self.style.WARNING('Switching to interactive mode for safety...'))
            self.stdout.write('')
            
            # Prompt user
            self.stats['prompted'] += 1
            return self.interactive_prompt(collab, dry_run)
        
        # If any rules were applied successfully, print and save
        if rules_applied:
            # Print all the changes
            for rule_applied, changes, prev_full, prev_first, prev_last, prev_suffix, prev_nick in rules_applied:
                self.print_auto_fix(collab, rule_applied, changes, prev_full, 
                                  prev_first, prev_last, prev_suffix, prev_nick)
            
            # Save if not dry run
            if not dry_run:
                collab.save()
                self.stdout.write(self.style.SUCCESS('  ✓ Saved'))
            else:
                self.stdout.write(self.style.WARNING('  (dry-run - not saved)'))
            
            self.stdout.write('')
            return 'auto'
        
        # No auto-fix possible, prompt user
        self.stats['prompted'] += 1
        return self.interactive_prompt(collab, dry_run)

    def needs_processing(self, collab):
        """
        Check if collaborator needs processing.
        Returns (bool, reason)
        """
        # Skip anonymous collaborators
        if collab.anonymous:
            return False, 'anonymous'
        
        # Skip if all name fields are empty
        if not collab.full_name and not collab.first_names and not collab.last_names:
            return False, 'all_empty'
        
        # Rule 1: Skip if already correct (full_name matches first_names + last_names)
        if collab.first_names and collab.last_names:
            expected_full_name = self.rebuild_full_name(collab)
            if collab.full_name == expected_full_name:
                # But still check Rule 1a (suffix might be in wrong field)
                if not self.check_rule_1a(collab):
                    return False, 'already_correct'
        
        # Rule 1b: Single name in last_names is already correct
        if not collab.first_names and collab.last_names and collab.full_name == collab.last_names:
            return False, 'already_correct_single_name'
        
        return True, None

    def try_auto_fix(self, collab):
        """
        Try to apply automatic fixes. Returns (rule_name, changes_dict) or None.
        """
        # Rule 8: Whitespace normalization (check first, before other rules)
        if self.check_rule_8(collab):
            return self.apply_rule_8(collab)
        
        # Rule 10: Single name in wrong field (first_names instead of last_names)
        if self.check_rule_10(collab):
            return self.apply_rule_10(collab)
        
        # Rule 9: Extract suffix from full_name (when components exist)
        if self.check_rule_9(collab):
            return self.apply_rule_9(collab)
        
        # Rule 1a: Suffix in last_names
        if self.check_rule_1a(collab):
            return self.apply_rule_1a(collab)
        
        # Rule 2: Suffix in first_names
        if self.check_rule_2(collab):
            return self.apply_rule_2(collab)
        
        # Rule 5: Comma-separated format (check before Rule 3)
        if self.check_rule_5(collab):
            return self.apply_rule_5(collab)
        
        # Rule 4: Parentheticals as nickname
        if self.check_rule_4(collab):
            return self.apply_rule_4(collab)
        
        # Rule 3: Middle name reconciliation
        if self.check_rule_3(collab):
            return self.apply_rule_3(collab)
        
        # Rule 6: Rebuild full_name if components are valid but don't match
        if self.check_rule_6(collab):
            return self.apply_rule_6(collab)
        
        return None

    # ============================================================================
    # Rule 8: Whitespace normalization
    # ============================================================================
    
    def check_rule_8(self, collab):
        """Check if full_name only differs from rebuilt by whitespace"""
        if not collab.full_name:
            return False
        
        # Get what the rebuilt full_name would be
        expected_full_name = self.rebuild_full_name(collab)
        
        # If they're already identical, no need to fix
        if collab.full_name == expected_full_name:
            return False
        
        # Check if the only difference is whitespace (strip, normalize spaces, replace non-breaking spaces)
        normalized_current = ' '.join(collab.full_name.replace('\xa0', ' ').split())
        normalized_expected = ' '.join(expected_full_name.split())
        
        # If they match after normalization, this is just a whitespace issue
        return normalized_current == normalized_expected
    
    def apply_rule_8(self, collab):
        """Normalize whitespace in full_name and component fields"""
        old_full_name = collab.full_name
        old_first_names = collab.first_names
        old_last_names = collab.last_names
        old_nickname = collab.nickname
        old_suffix = collab.name_suffix
        
        # Normalize whitespace in all fields
        if collab.first_names:
            collab.first_names = ' '.join(collab.first_names.replace('\xa0', ' ').split())
        if collab.last_names:
            collab.last_names = ' '.join(collab.last_names.replace('\xa0', ' ').split())
        if collab.nickname:
            collab.nickname = ' '.join(collab.nickname.replace('\xa0', ' ').split())
        if collab.name_suffix:
            collab.name_suffix = ' '.join(collab.name_suffix.replace('\xa0', ' ').split())
        
        # Rebuild full_name from normalized components
        collab.full_name = self.rebuild_full_name(collab)
        
        return ('rule_8', {
            'old_full_name': old_full_name,
            'new_full_name': collab.full_name,
            'type': 'whitespace_normalization',
        })

    # ============================================================================
    # Rule 10: Single name in wrong field (move from first_names to last_names)
    # ============================================================================
    
    def check_rule_10(self, collab):
        """Check if single name is in first_names but should be in last_names"""
        # Single name in first_names, empty last_names, and full_name matches first_names
        if collab.first_names and not collab.last_names and collab.full_name == collab.first_names:
            return True
        return False
    
    def apply_rule_10(self, collab):
        """Move single name from first_names to last_names"""
        old_first_names = collab.first_names
        
        # Move to last_names
        collab.last_names = collab.first_names
        collab.first_names = ''
        
        # Rebuild full_name (should stay the same)
        collab.full_name = self.rebuild_full_name(collab)
        
        return ('rule_10', {
            'moved_from': 'first_names',
            'moved_to': 'last_names',
            'name': old_first_names,
        })

    # ============================================================================
    # Rule 9: Extract suffix from full_name (when components exist)
    # ============================================================================
    
    def check_rule_9(self, collab):
        """Check if full_name has a suffix that's missing from name_suffix"""
        # Need full_name and at least one component field, but no existing suffix
        if not collab.full_name or collab.name_suffix:
            return False
        
        if not (collab.first_names or collab.last_names):
            return False
        
        # Check if full_name ends with a suffix (case-sensitive for Roman numerals)
        suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$'
        return bool(re.search(suffix_pattern, collab.full_name))
    
    def apply_rule_9(self, collab):
        """Extract suffix from full_name and populate name_suffix"""
        suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$'
        match = re.search(suffix_pattern, collab.full_name)
        
        if match:
            suffix = match.group(1)  # Capture just the suffix (without comma/space)
            
            # Store the suffix
            collab.name_suffix = suffix
            
            # Also clean the suffix from first_names and last_names if present
            # This ensures subsequent rules don't try to re-extract it
            if collab.first_names:
                first_suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)(?:\s|$)'
                collab.first_names = re.sub(first_suffix_pattern, '', collab.first_names).strip()
                collab.first_names = re.sub(r'\s+', ' ', collab.first_names)  # Clean up spaces
            
            if collab.last_names:
                last_suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$'
                collab.last_names = re.sub(last_suffix_pattern, '', collab.last_names).strip()
            
            # Rebuild full_name from components (which now includes suffix)
            collab.full_name = self.rebuild_full_name(collab)
            
            return ('rule_9', {
                'suffix_extracted': suffix,
                'new_full_name': collab.full_name,
            })
        
        return None

    # ============================================================================
    # Rule 1a: Suffix in last_names
    # ============================================================================
    
    def check_rule_1a(self, collab):
        """Check if last_names ends with a suffix"""
        if not collab.last_names:
            return False
        
        # Skip if suffix is already populated
        if collab.name_suffix:
            return False
        
        # Match suffixes with optional comma: Jr, Sr, I, II, III, IV, V, etc.
        # Case-sensitive for Roman numerals, must be preceded by space or comma+space
        suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$'
        return bool(re.search(suffix_pattern, collab.last_names))

    def apply_rule_1a(self, collab):
        """Extract suffix from last_names to name_suffix"""
        # Match suffixes with optional comma, capture the suffix without comma/space
        suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$'
        match = re.search(suffix_pattern, collab.last_names)
        
        if match:
            suffix = match.group(1)  # Captures just the suffix without comma/space
            # Remove the entire match (including comma and space)
            clean_last_names = re.sub(suffix_pattern, '', collab.last_names).strip()
            
            collab.last_names = clean_last_names
            collab.name_suffix = suffix
            collab.full_name = self.rebuild_full_name(collab)
            
            return ('rule_1a', {
                'suffix_extracted': suffix,
                'cleaned_last_names': clean_last_names,
            })
        
        return None

    # ============================================================================
    # Rule 2: Suffix in first_names
    # ============================================================================
    
    def check_rule_2(self, collab):
        """Check if first_names contains a suffix"""
        if not collab.first_names:
            return False
        
        # Skip if suffix is already populated
        if collab.name_suffix:
            return False
        
        # Match suffixes with optional comma: Jr, Sr, I, II, III, IV, V, etc.
        # Case-sensitive for Roman numerals, must be preceded by space or comma+space
        suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)(?:\s|$)'
        return bool(re.search(suffix_pattern, collab.first_names))

    def apply_rule_2(self, collab):
        """Extract suffix from first_names to name_suffix"""
        # Match suffixes with optional comma, capture the suffix with period if present
        suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)(?:\s|$)'
        match = re.search(suffix_pattern, collab.first_names)
        
        if match:
            suffix = match.group(1)  # Captures the suffix with period if present
            # Remove the entire match (including comma and space if present, but not trailing space/end)
            clean_first_names = re.sub(r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)', '', collab.first_names).strip()
            clean_first_names = re.sub(r'\s+', ' ', clean_first_names)  # Clean up extra spaces
            
            collab.first_names = clean_first_names
            collab.name_suffix = suffix
            collab.full_name = self.rebuild_full_name(collab)
            
            return ('rule_2', {
                'suffix_extracted': suffix,
                'cleaned_first_names': clean_first_names,
            })
        
        return None

    # ============================================================================
    # Rule 3: Middle name reconciliation
    # ============================================================================
    
    def check_rule_3(self, collab):
        """Check if we can reconcile middle names between full_name and first_names/last_names"""
        # Need both first and last names, and full_name
        if not (collab.first_names and collab.last_names and collab.full_name):
            return False
        
        # Check if full_name has additional content between first and last
        # This is a simple heuristic - full_name is longer than first+last
        combined_length = len(collab.first_names) + len(collab.last_names)
        return len(collab.full_name) > combined_length + 1  # +1 for space

    def apply_rule_3(self, collab):
        """Reconcile middle names/initials"""
        # Case A: first_names looks like initials, move to nickname
        initial_pattern = r'^[A-Z]\.[A-Z]\.$|^[A-Z]\.[A-Z]$|^[A-Z]{2}$'
        if re.match(initial_pattern, collab.first_names):
            # Try to extract actual first name from full_name
            full_parts = collab.full_name.split()
            if len(full_parts) >= 2:
                # Assume first part(s) before last_names are first_names
                last_names_parts = collab.last_names.split()
                
                # Find where last_names starts in full_name
                try:
                    last_idx = full_parts.index(last_names_parts[0])
                    extracted_first = ' '.join(full_parts[:last_idx])
                    
                    old_first = collab.first_names
                    collab.nickname = old_first
                    collab.first_names = extracted_first
                    collab.full_name = self.rebuild_full_name(collab)
                    
                    return ('rule_3', {
                        'type': 'initials_to_nickname',
                        'extracted_first': extracted_first,
                        'moved_to_nickname': old_first,
                    })
                except (ValueError, IndexError):
                    pass
        
        # Case B: Add middle initial/name from full_name to first_names
        # ONLY if middle content comes AFTER first_names (not before)
        
        # Check if first_names appears at the beginning of full_name
        # This ensures we're adding middle names, not dealing with titles or "goes by middle name" cases
        if not collab.full_name.startswith(collab.first_names):
            # Content appears BEFORE first_names (could be title, or additional first name)
            # Skip auto-fix, let user handle interactively
            return None
        
        full_parts = collab.full_name.split()
        first_parts = collab.first_names.split()
        last_parts = collab.last_names.split()
        
        # Check if full_name has more tokens between first and last
        if len(full_parts) > len(first_parts) + len(last_parts):
            # Try to identify middle tokens
            try:
                # Find last_names position in full_name
                last_start_idx = None
                for i in range(len(full_parts)):
                    if full_parts[i] == last_parts[0]:
                        last_start_idx = i
                        break
                
                if last_start_idx and last_start_idx > len(first_parts):
                    # There are middle tokens AFTER first_names
                    middle_tokens = full_parts[len(first_parts):last_start_idx]
                    new_first_names = collab.first_names + ' ' + ' '.join(middle_tokens)
                    
                    collab.first_names = new_first_names
                    collab.full_name = self.rebuild_full_name(collab)
                    
                    return ('rule_3', {
                        'type': 'middle_name_added',
                        'added_middle': ' '.join(middle_tokens),
                    })
            except (ValueError, IndexError):
                pass
        
        return None

    # ============================================================================
    # Rule 4: Parentheticals as nickname
    # ============================================================================
    
    def check_rule_4(self, collab):
        """Check if full_name contains parentheticals"""
        if not collab.full_name:
            return False
        return '(' in collab.full_name and ')' in collab.full_name

    def apply_rule_4(self, collab):
        """Extract parentheticals as nickname"""
        match = re.search(r'\(([^)]+)\)', collab.full_name)
        if match:
            nickname = match.group(1)
            # Remove parenthetical from full_name for parsing
            name_without_parens = re.sub(r'\s*\([^)]+\)\s*', ' ', collab.full_name).strip()
            name_without_parens = re.sub(r'\s+', ' ', name_without_parens)  # Clean up spaces
            
            # Parse the remaining name
            parts = name_without_parens.split()
            if len(parts) >= 2:
                # Assume last part is last name, rest is first name
                collab.first_names = ' '.join(parts[:-1])
                collab.last_names = parts[-1]
            elif len(parts) == 1:
                # Single name - put in last_names
                collab.first_names = ''
                collab.last_names = parts[0]
            
            collab.nickname = nickname
            collab.full_name = self.rebuild_full_name(collab)
            
            return ('rule_4', {
                'nickname_extracted': nickname,
                'parsed_name': name_without_parens,
            })
        
        return None

    # ============================================================================
    # Rule 5: Comma-separated format (LastName, FirstName)
    # ============================================================================
    
    def check_rule_5(self, collab):
        """Check if full_name is in 'LastName, FirstName' format"""
        if not collab.full_name:
            return False
        # Only apply if first_names and last_names are empty
        if collab.first_names or collab.last_names:
            return False
        return ',' in collab.full_name

    def apply_rule_5(self, collab):
        """Reverse comma-separated format"""
        parts = collab.full_name.split(',', 1)
        if len(parts) == 2:
            last_name = parts[0].strip()
            first_name = parts[1].strip()
            
            collab.first_names = first_name
            collab.last_names = last_name
            collab.full_name = self.rebuild_full_name(collab)
            
            return ('rule_5', {
                'reversed_from': f"{last_name}, {first_name}",
                'to': f"{first_name} {last_name}",
            })
        
        return None

    # ============================================================================
    # Rule 6: Rebuild full_name if components don't match
    # ============================================================================
    
    def check_rule_6(self, collab):
        """Check if full_name doesn't match the components"""
        # Must have at least one of first_names or last_names
        if not (collab.first_names or collab.last_names):
            return False
        
        # Check if current full_name matches what we'd build from components
        expected_full_name = self.rebuild_full_name(collab)
        
        # If full_name matches, no need to rebuild
        if collab.full_name == expected_full_name:
            return False
        
        # Only skip auto-fix if nickname needs cleaning (Rule 7)
        if collab.nickname and collab.last_names:
            # Check if nickname ends with last_names (needs interactive fixing)
            if collab.nickname.endswith(collab.last_names):
                cleaned_nickname = collab.nickname[:-(len(collab.last_names))].strip()
                if cleaned_nickname:  # Nickname needs cleaning
                    return False  # Will be handled interactively
        
        # Otherwise, auto-fix is okay
        return True

    def apply_rule_6(self, collab):
        """Rebuild full_name from valid components"""
        old_full_name = collab.full_name
        collab.full_name = self.rebuild_full_name(collab)
        
        return ('rule_6', {
            'old_full_name': old_full_name,
            'new_full_name': collab.full_name,
        })

    # ============================================================================
    # Interactive prompt for ambiguous cases
    # ============================================================================
    
    def interactive_prompt(self, collab, dry_run):
        """Handle interactive prompting for ambiguous cases"""
        self.stdout.write(self.style.WARNING('=' * 70))
        self.stdout.write(self.style.WARNING(f'[PROMPT] PK {collab.pk}: Manual input needed'))
        self.stdout.write(self.style.WARNING('=' * 70))
        
        # Detect case type
        if self.has_non_latin_chars(collab.full_name):
            self.stdout.write(self.style.NOTICE('⚠  Indigenous/Non-Latin characters detected'))
            self.stdout.write(self.style.NOTICE('   Please manually parse to respect cultural naming conventions.'))
        
        # Show current values
        self.stdout.write(f'\nCurrent values:')
        self.stdout.write(f'  full_name:    "{collab.full_name}"')
        self.stdout.write(f'  first_names:  "{collab.first_names}"')
        self.stdout.write(f'  last_names:   "{collab.last_names}"')
        self.stdout.write(f'  name_suffix:  "{collab.name_suffix}"')
        self.stdout.write(f'  nickname:     "{collab.nickname}"')
        
        # Check if we can offer a "rebuild" option
        rebuilt_full_name = self.rebuild_full_name(collab)
        offer_rebuild = (collab.first_names or collab.last_names) and (rebuilt_full_name != collab.full_name)
        
        # Rule 7: Check if nickname contains last_names at the end
        offer_clean_nickname = False
        cleaned_nickname = None
        if collab.nickname and collab.last_names:
            # Check if nickname ends with last_names
            if collab.nickname.endswith(collab.last_names):
                # Extract just the nickname part (remove last_names from end)
                cleaned_nickname = collab.nickname[:-(len(collab.last_names))].strip()
                if cleaned_nickname:  # Only offer if there's something left
                    offer_clean_nickname = True
        
        # If only full_name exists, try to suggest a parse
        if collab.full_name and not collab.first_names and not collab.last_names:
            suggested = self.suggest_parse(collab.full_name)
            if suggested:
                self.stdout.write(f'\nSuggested parsing:')
                self.stdout.write(f'  first_names:  "{suggested["first"]}"')
                self.stdout.write(f'  last_names:   "{suggested["last"]}"')
                if suggested.get('suffix'):
                    self.stdout.write(f'  name_suffix:  "{suggested["suffix"]}"')
        
        # Show rebuilt option if available
        if offer_rebuild:
            self.stdout.write(f'\nRebuilt full_name from components:')
            self.stdout.write(f'  "{rebuilt_full_name}"')
        
        # Show cleaned nickname option if available (Rule 7)
        if offer_clean_nickname:
            self.stdout.write(f'\n⚠  Nickname appears to contain last_names at the end')
            self.stdout.write(f'  Current nickname: "{collab.nickname}"')
            self.stdout.write(f'  Cleaned nickname: "{cleaned_nickname}"')
            # Show what full_name would be with cleaned nickname
            temp_collab_cleaned = type('obj', (object,), {
                'first_names': collab.first_names,
                'last_names': collab.last_names,
                'name_suffix': collab.name_suffix,
                'nickname': cleaned_nickname
            })()
            cleaned_full_name = self.rebuild_full_name(temp_collab_cleaned)
            self.stdout.write(f'  Result full_name: "{cleaned_full_name}"')
        
        # Get user input
        self.stdout.write('\nOptions:')
        if offer_clean_nickname:
            self.stdout.write('  [A] Accept cleaned nickname and rebuild full_name')
        if offer_rebuild:
            self.stdout.write('  [R] Accept rebuilt full_name (keep current nickname)')
        self.stdout.write('  [M] Manual entry')
        self.stdout.write('  [S] Skip (leave as-is)')
        self.stdout.write('  [Q] Quit')
        
        choice = input('\nYour choice: ').strip().upper()
        
        if choice == 'Q':
            raise KeyboardInterrupt()
        elif choice == 'S':
            self.stdout.write(self.style.WARNING('Skipped'))
            self.stdout.write('')
            return 'skip'
        elif choice == 'A' and offer_clean_nickname:
            return self.accept_cleaned_nickname(collab, cleaned_nickname, dry_run)
        elif choice == 'R' and offer_rebuild:
            return self.accept_rebuilt(collab, rebuilt_full_name, dry_run)
        elif choice == 'M':
            return self.manual_entry(collab, dry_run)
        else:
            self.stdout.write(self.style.WARNING('Invalid choice, skipping...'))
            self.stdout.write('')
            return 'skip'

    def accept_cleaned_nickname(self, collab, cleaned_nickname, dry_run):
        """Accept the cleaned nickname (Rule 7: remove last_names from nickname)"""
        old_nickname = collab.nickname
        old_full_name = collab.full_name
        
        collab.nickname = cleaned_nickname
        collab.full_name = self.rebuild_full_name(collab)
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ Accepted cleaned nickname'))
        self.stdout.write(f'  Old nickname:  "{old_nickname}"')
        self.stdout.write(f'  New nickname:  "{cleaned_nickname}"')
        self.stdout.write(f'  Old full_name: "{old_full_name}"')
        self.stdout.write(f'  New full_name: "{collab.full_name}"')
        
        if not dry_run:
            collab.save(update_fields=['nickname', 'full_name'])
            self.stdout.write(self.style.SUCCESS('  ✓ Saved'))
        else:
            self.stdout.write(self.style.WARNING('  (dry-run - not saved)'))
        
        self.stdout.write('')
        return 'prompt'

    def accept_rebuilt(self, collab, rebuilt_full_name, dry_run):
        """Accept the rebuilt full_name from components"""
        old_full_name = collab.full_name
        collab.full_name = rebuilt_full_name
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ Accepted rebuilt full_name'))
        self.stdout.write(f'  Old: "{old_full_name}"')
        self.stdout.write(f'  New: "{rebuilt_full_name}"')
        
        if not dry_run:
            collab.save(update_fields=['full_name'])
            self.stdout.write(self.style.SUCCESS('  ✓ Saved'))
        else:
            self.stdout.write(self.style.WARNING('  (dry-run - not saved)'))
        
        self.stdout.write('')
        return 'prompt'

    def manual_entry(self, collab, dry_run):
        """Handle manual entry of name fields"""
        self.stdout.write('\nEnter new values (press Enter to keep current):')
        
        # Get input for each field with current values as defaults
        new_first = input(f'  first_names [{collab.first_names}]: ').strip()
        new_last = input(f'  last_names [{collab.last_names}]: ').strip()
        new_suffix = input(f'  name_suffix [{collab.name_suffix}]: ').strip()
        new_nickname = input(f'  nickname [{collab.nickname}]: ').strip()
        
        # Only update if user provided input (empty input = keep current)
        # Use 'is not' to distinguish between "no input" vs "intentionally clearing"
        # For now, empty input keeps the current value
        collab.first_names = new_first if new_first != '' else collab.first_names
        collab.last_names = new_last if new_last != '' else collab.last_names
        collab.name_suffix = new_suffix if new_suffix != '' else collab.name_suffix
        collab.nickname = new_nickname if new_nickname != '' else collab.nickname
        
        # Rebuild full_name
        collab.full_name = self.rebuild_full_name(collab)
        
        # Show preview
        self.stdout.write('\nPreview:')
        self.stdout.write(f'  first_names:  "{collab.first_names}"')
        self.stdout.write(f'  last_names:   "{collab.last_names}"')
        self.stdout.write(f'  name_suffix:  "{collab.name_suffix}"')
        self.stdout.write(f'  nickname:     "{collab.nickname}"')
        self.stdout.write(f'  full_name:    "{collab.full_name}"')
        
        # Confirm
        confirm = input('\nSave? [Y/n]: ').strip().lower()
        if confirm != 'n':
            if not dry_run:
                collab.save()
                self.stdout.write(self.style.SUCCESS('  ✓ Saved'))
            else:
                self.stdout.write(self.style.WARNING('  (dry-run - not saved)'))
        else:
            self.stdout.write(self.style.WARNING('  Cancelled'))
        
        self.stdout.write('')
        return 'prompt'

    # ============================================================================
    # Helper functions
    # ============================================================================
    
    def rebuild_full_name(self, collab):
        """Rebuild full_name from components"""
        parts = []
        
        if collab.first_names:
            parts.append(collab.first_names)
        
        if collab.nickname:
            parts.append(f'"{collab.nickname}"')
        
        if collab.last_names:
            parts.append(collab.last_names)
        
        if collab.name_suffix:
            parts.append(collab.name_suffix)
        
        return ' '.join(parts) if parts else ''

    def has_non_latin_chars(self, text):
        """Check if text contains non-Latin characters"""
        if not text:
            return False
        # Check for Cherokee syllabary, CJK, Arabic, etc.
        return bool(re.search(r'[^\x00-\x7F\u00C0-\u017F]', text))

    def suggest_parse(self, full_name):
        """Suggest a parse for full_name"""
        if not full_name:
            return None
        
        # Check for suffix with optional comma (case-sensitive for Roman numerals)
        suffix_pattern = r'(?:,\s+|\s+)(Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$'
        suffix_match = re.search(suffix_pattern, full_name)
        suffix = suffix_match.group(1) if suffix_match else None  # Capture without comma/space
        
        # Remove suffix for parsing
        name_without_suffix = re.sub(suffix_pattern, '', full_name).strip()
        
        # Simple parse: assume last token is last name, rest is first name
        parts = name_without_suffix.split()
        if len(parts) >= 2:
            first = ' '.join(parts[:-1])
            last = parts[-1]
            return {'first': first, 'last': last, 'suffix': suffix}
        elif len(parts) == 1:
            # Single name - suggest putting in last_names
            return {'first': '', 'last': parts[0], 'suffix': suffix}
        
        return None

    def print_skip(self, collab, reason):
        """Print skipped collaborator"""
        reason_names = {
            'already_correct': 'Already correct',
            'anonymous': 'Anonymous collaborator',
            'all_empty': 'No name data',
        }
        
        self.stdout.write(f'[SKIP] PK {collab.pk}: {reason_names.get(reason, reason)}')
        self.stdout.write(f'  full_name:    "{collab.full_name}"')
        self.stdout.write(f'  first_names:  "{collab.first_names}"')
        self.stdout.write(f'  last_names:   "{collab.last_names}"')
        self.stdout.write(f'  name_suffix:  "{collab.name_suffix}"')
        self.stdout.write(f'  nickname:     "{collab.nickname}"')
        self.stdout.write('')

    def print_auto_fix(self, collab, rule, changes, orig_full, orig_first, orig_last, orig_suffix, orig_nick):
        """Print auto-fix result"""
        rule_names = {
            'rule_1a': 'Suffix in last_names',
            'rule_2': 'Suffix in first_names',
            'rule_3': 'Middle name reconciliation',
            'rule_4': 'Parenthetical to nickname',
            'rule_5': 'Comma format reversal',
            'rule_6': 'Rebuild full_name from components',
            'rule_8': 'Whitespace normalization',
            'rule_9': 'Extract suffix from full_name',
            'rule_10': 'Move single name to last_names',
        }
        
        self.stdout.write(self.style.SUCCESS(f'[AUTO] PK {collab.pk}: {rule_names.get(rule, rule)}'))
        self.stdout.write(f'  Original full_name: "{orig_full}"')
        
        # Show what changed (with arrows for changed fields)
        if orig_first != collab.first_names:
            self.stdout.write(f'  first_names:  "{orig_first}" → "{collab.first_names}"')
        else:
            self.stdout.write(f'  first_names:  "{collab.first_names}"')
            
        if orig_last != collab.last_names:
            self.stdout.write(f'  last_names:   "{orig_last}" → "{collab.last_names}"')
        else:
            self.stdout.write(f'  last_names:   "{collab.last_names}"')
            
        if orig_suffix != collab.name_suffix:
            self.stdout.write(f'  name_suffix:  "{orig_suffix}" → "{collab.name_suffix}"')
        else:
            self.stdout.write(f'  name_suffix:  "{collab.name_suffix}"')
            
        if orig_nick != collab.nickname:
            self.stdout.write(f'  nickname:     "{orig_nick}" → "{collab.nickname}"')
        else:
            self.stdout.write(f'  nickname:     "{collab.nickname}"')
        
        self.stdout.write(f'  Rebuilt full_name: "{collab.full_name}"')

    def print_final_stats(self):
        """Print final statistics"""
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('MIGRATION COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(f'Total processed:     {self.stats["total_processed"]}')
        self.stdout.write(f'├─ Auto-fixed:       {self.stats["auto_fixed"]}')
        self.stdout.write(f'├─ User prompted:    {self.stats["prompted"]}')
        self.stdout.write(f'├─ Skipped:          {self.stats["skipped"]}')
        self.stdout.write(f'└─ Errors:           {self.stats["errors"]}')
        self.stdout.write('')
        self.stdout.write('Breakdown by rule:')
        self.stdout.write(f'├─ Rule 1a (suffix in last_names):     {self.stats["rule_1a"]}')
        self.stdout.write(f'├─ Rule 2 (suffix in first_names):     {self.stats["rule_2"]}')
        self.stdout.write(f'├─ Rule 3 (middle name reconciliation): {self.stats["rule_3"]}')
        self.stdout.write(f'├─ Rule 4 (parentheticals):            {self.stats["rule_4"]}')
        self.stdout.write(f'└─ Rule 5 (comma format):              {self.stats["rule_5"]}')
        self.stdout.write(self.style.SUCCESS('=' * 70))

