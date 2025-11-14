"""
Internal API serializers for React frontend
Simplified, flat structure optimized for frontend consumption
"""
from rest_framework import serializers
from metadata.models import Item, Collection, Collaborator, Languoid, ItemTitle, CollaboratorRole


class InternalItemTitleSerializer(serializers.ModelSerializer):
    """Writable title serializer for internal API with business rule validation"""
    language_name = serializers.CharField(source='language.name', read_only=True)
    language_iso = serializers.CharField(source='language.iso', read_only=True)
    
    class Meta:
        model = ItemTitle
        fields = ['id', 'title', 'language', 'language_name', 'language_iso', 'default']
    
    def validate(self, attrs):
        """Validate title data and enforce business rules"""
        # Get the item from the context (will be set by the viewset)
        item = self.context.get('item')
        if not item:
            raise serializers.ValidationError("Item context is required")
        
        # If setting this title as default, we need to unset others
        if attrs.get('default', False):
            # This will be handled in the viewset's perform_create/perform_update
            pass
            
        return attrs
    
    def create(self, validated_data):
        """Create new title with proper item association"""
        item = self.context['item']
        validated_data['item'] = item
        
        # Set modified_by from request user
        request = self.context.get('request')
        if request and request.user:
            validated_data['modified_by'] = str(request.user)
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update title with modified_by tracking"""
        request = self.context.get('request')
        if request and request.user:
            validated_data['modified_by'] = str(request.user)
            
        return super().update(instance, validated_data)


class InternalItemSerializer(serializers.ModelSerializer):
    """Comprehensive Item serializer for internal API - provides flat structure matching Django template sections"""
    
    # Related data with simple names
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    collection_abbr = serializers.CharField(source='collection.collection_abbr', read_only=True)
    titles = InternalItemTitleSerializer(source='title_item', many=True, read_only=True)
    
    # Primary title (the default one)
    primary_title = serializers.SerializerMethodField()
    
    # Language names (simplified) - DEPRECATED in favor of full objects
    language_names = serializers.SerializerMethodField()
    
    # Language relationships (full objects for editing) - nested serializer for read, IDs for write
    language = serializers.SerializerMethodField()
    
    # Collaborator names (simplified) 
    collaborator_names = serializers.SerializerMethodField()
    
    # Access level field (writable)
    item_access_level = serializers.CharField(required=False, allow_blank=True)
    item_access_level_display = serializers.CharField(source='get_item_access_level_display', read_only=True)
    
    # Display fields for choice fields
    resource_type_display = serializers.CharField(source='get_resource_type_display', read_only=True)
    availability_status_display = serializers.CharField(source='get_availability_status_display', read_only=True)
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    type_of_accession_display = serializers.CharField(source='get_type_of_accession_display', read_only=True)
    original_format_medium_display = serializers.CharField(source='get_original_format_medium_display', read_only=True)
    
    # MultiSelectField - writable as list, stored as comma-separated string
    genre = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    language_description_type = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    
    # Browse categories - read-only, calculated field (automatically set by pre_save signal)
    browse_categories = serializers.SerializerMethodField()
    
    # MultiSelectField display values
    genre_display = serializers.SerializerMethodField()
    language_description_type_display = serializers.SerializerMethodField()
    browse_categories_display = serializers.SerializerMethodField()
    
    # Boolean field display
    permission_to_publish_online_display = serializers.SerializerMethodField()
    migrate_display = serializers.SerializerMethodField()
    
    # Description (using the correct field name)
    description = serializers.CharField(source='description_scope_and_content', required=False, allow_blank=True)
    
    # Coordinate fields for geographic location
    latitude = serializers.DecimalField(
        max_digits=22, 
        decimal_places=16, 
        required=False, 
        allow_null=True,
        help_text="Latitude coordinate (-90 to 90)"
    )
    longitude = serializers.DecimalField(
        max_digits=22, 
        decimal_places=16, 
        required=False, 
        allow_null=True,
        help_text="Longitude coordinate (-180 to 180)"
    )
    
    class Meta:
        model = Item
        fields = [
            # Basic identifiers
            'id', 'uuid', 'slug', 'catalog_number',
            
            # General section (from Django template)
            'catalog_number', 'item_access_level', 'item_access_level_display', 'call_number', 
            'accession_date', 'additional_digital_file_location',
            
            # Titles
            'primary_title', 'titles', 'indigenous_title', 'english_title',
            
            # Content & Description  
            'description', 'resource_type', 'resource_type_display',
            'genre', 'genre_display', 'language_description_type', 'language_description_type_display',
            'browse_categories', 'browse_categories_display',
            'language_names', 'collaborator_names', 'creation_date',
            'associated_ephemera', 'access_level_restrictions', 'copyrighted_notes',
            'permission_to_publish_online', 'permission_to_publish_online_display',
            
            # Availability & Condition
            'availability_status', 'availability_status_display', 'availability_status_notes',
            'condition', 'condition_display', 'condition_notes', 'ipm_issues',
            'conservation_treatments_performed', 'conservation_recommendation',
            
            # Accessions section (from Django template)
            'accession_number', 'accession_date', 'type_of_accession', 'type_of_accession_display',
            'acquisition_notes', 'project_grant', 'collection', 'collection_name', 'collection_abbr',
            'collector_name', 'collector_info', 'collectors_number', 'collection_date', 
            'collecting_notes', 'depositor_name', 'depositor_contact_information', 'deposit_date',
            
            # Location section (from Django template)
            'municipality_or_township', 'county_or_parish', 'state_or_province',
            'country_or_territory', 'global_region', 'latitude', 'longitude',
            'recording_context', 'public_event',
            'original_format_medium', 'original_format_medium_display', 'recorded_on',
            'equipment_used', 'software_used', 'digital_file_location', 'location_of_original',
            'other_information',
            
            # Books section (from Django template)
            'publisher', 'publisher_address', 'isbn', 'loc_catalog_number',
            'total_number_of_pages_and_physical_description',
            
            # External section (from Django template)
            'temporary_accession_number', 'lender_loan_number', 'other_institutional_number',
            
            # Deprecated section (from Django template)
            'migration_file_format', 'migration_location', 'cataloged_by', 'cataloged_date',
            'filemaker_legacy_pk_id',
            
            # Migration section (from Django template)
            'migrate', 'migrate_display',
            
            # Versioning section (from Django template)
            'added', 'updated', 'modified_by',
            
            # Keep existing fields for compatibility
            'language', 'collaborator'
        ]
        read_only_fields = ['id', 'uuid', 'slug', 'added', 'updated', 'browse_categories', 'browse_categories_display']
    
    def get_primary_title(self, obj):
        """Get the primary/default title"""
        default_title = obj.title_item.filter(default=True).first()
        if default_title:
            return default_title.title
        # If no default title, get the first one
        first_title = obj.title_item.first()
        return first_title.title if first_title else None
    
    def get_language_names(self, obj):
        """Get simple list of language names"""
        return [lang.name for lang in obj.language.all()]
    
    def get_language(self, obj):
        """Return full Languoid objects for languages"""
        return InternalLanguoidSerializer(obj.language.all(), many=True).data
    
    def get_collaborator_names(self, obj):
        """Get simple list of collaborator names"""
        return [collab.full_name for collab in obj.collaborator.all()]
    
    def get_genre_display(self, obj):
        """Get human-readable genre labels for MultiSelectField"""
        if not obj.genre:
            return []
        
        # Import choices here to avoid circular imports
        from metadata.models import GENRE_CHOICES
        
        # Create a lookup dict for efficiency
        genre_dict = dict(GENRE_CHOICES)
        
        # Return display names for selected genres
        return [genre_dict.get(genre_value, genre_value) for genre_value in obj.genre]
    
    def get_language_description_type_display(self, obj):
        """Get human-readable language description type labels for MultiSelectField"""
        if not obj.language_description_type:
            return []
        
        # Import choices here to avoid circular imports
        from metadata.models import LANGUAGE_DESCRIPTION_CHOICES
        
        # Create a lookup dict for efficiency
        lang_desc_dict = dict(LANGUAGE_DESCRIPTION_CHOICES)
        
        # Return display names for selected values
        return [lang_desc_dict.get(value, value) for value in obj.language_description_type]
    
    def get_browse_categories(self, obj):
        """Get browse categories as a list (read-only calculated field)"""
        raw_value = obj.browse_categories
        
        if not raw_value:
            return []
        
        # Convert to list if it's a string (MultiSelectField can return either)
        if isinstance(raw_value, str):
            return [v.strip() for v in raw_value.split(',') if v.strip()]
        return list(raw_value) if raw_value else []
    
    def get_browse_categories_display(self, obj):
        """Get human-readable browse category labels for MultiSelectField"""
        if not obj.browse_categories:
            return []
        
        # Import choices here to avoid circular imports
        from metadata.models import BROWSE_CATEGORY_CHOICES
        
        # Create a lookup dict for efficiency
        browse_cat_dict = dict(BROWSE_CATEGORY_CHOICES)
        
        # Convert to list if it's a string (MultiSelectField can return either)
        if isinstance(obj.browse_categories, str):
            categories_list = [v.strip() for v in obj.browse_categories.split(',') if v.strip()]
        else:
            categories_list = list(obj.browse_categories) if obj.browse_categories else []
        
        # Return display names for selected values
        return [browse_cat_dict.get(value, value) for value in categories_list]
    
    def get_permission_to_publish_online_display(self, obj):
        """Get human-readable boolean display"""
        if obj.permission_to_publish_online is None:
            return 'Not specified'
        return 'Yes' if obj.permission_to_publish_online else 'No'
    
    def get_migrate_display(self, obj):
        """Get human-readable boolean display for migrate field"""
        return 'Yes' if obj.migrate else 'No'
    
    # Date field validation methods
    def validate_creation_date(self, value):
        """Validate and standardize creation_date field"""
        if value:
            from metadata.signals import standardize_date_format
            try:
                standardized = standardize_date_format(value)
                return standardized
            except Exception as e:
                # Log the error for debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Date validation failed for '{value}': {e}")
                raise
        return value
    
    def validate_accession_date(self, value):
        """Validate and standardize accession_date field"""
        if value:
            from metadata.signals import standardize_date_format
            return standardize_date_format(value)
        return value
    
    def validate_collection_date(self, value):
        """Validate and standardize collection_date field"""
        if value:
            from metadata.signals import standardize_date_format
            return standardize_date_format(value)
        return value
    
    def validate_deposit_date(self, value):
        """Validate and standardize deposit_date field"""
        if value:
            from metadata.signals import standardize_date_format
            return standardize_date_format(value)
        return value
    
    def validate_cataloged_date(self, value):
        """Validate and standardize cataloged_date field"""
        if value:
            from metadata.signals import standardize_date_format
            return standardize_date_format(value)
        return value
    
    # Coordinate field validation methods
    def validate_latitude(self, value):
        """Validate latitude is within valid range (-90 to 90)"""
        if value is not None:
            if value < -90 or value > 90:
                raise serializers.ValidationError("Latitude must be between -90 and 90")
        return value
    
    def validate_longitude(self, value):
        """Validate longitude is within valid range (-180 to 180)"""
        if value is not None:
            if value < -180 or value > 180:
                raise serializers.ValidationError("Longitude must be between -180 and 180")
        return value
    
    def validate_genre(self, value):
        """Validate genre field - ensure it's a list and convert to comma-separated string for MultiSelectField"""
        if value is None:
            return []
        
        # If it's already a list, return it as-is (DRF will handle conversion)
        if isinstance(value, list):
            return value
        
        # If it's a string (shouldn't happen, but handle it), split it
        if isinstance(value, str):
            return [v.strip() for v in value.split(',') if v.strip()]
        
        return value
    
    def update(self, instance, validated_data):
        """
        Custom update to handle M2M language field.
        
        For language field, we need to:
        1. Extract the M2M data from the initial request data (not validated_data, since it's a SerializerMethodField)
        2. Update the regular fields first
        3. Update the M2M relationships using Django's built-in .set() method
        """
        from metadata.models import Languoid
        
        # Extract M2M field data from initial_data (raw request data)
        # Since language is a SerializerMethodField (read-only),
        # it won't be in validated_data. We need to get it from initial_data.
        initial_data = self.initial_data
        language_ids = initial_data.get('language', None)
        
        # Get modified_by value for tracking who made the change
        request = self.context.get('request')
        modified_by_value = str(request.user) if request and request.user else 'unknown'
        
        # Update regular fields (including modified_by from request)
        if request and request.user:
            validated_data['modified_by'] = modified_by_value
        
        # Update the instance with non-M2M fields
        # Note: browse_categories is calculated in pre_save signal and will be saved automatically
        instance = super().update(instance, validated_data)
        
        # Update language M2M relationship
        if language_ids is not None:
            # Use Django's built-in set() method for M2M relationships
            # This will automatically trigger m2m_changed signals
            instance.language.set(language_ids)
        
        return instance


class InternalCollectionSerializer(serializers.ModelSerializer):
    """Comprehensive Collection serializer for internal API"""
    
    # Display fields for MultiSelectFields
    access_levels_display = serializers.SerializerMethodField()
    genres_display = serializers.SerializerMethodField()
    
    # Language names for display
    language_names = serializers.SerializerMethodField()
    
    # Boolean field display
    expecting_additions_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Collection
        fields = [
            # Basic identifiers
            'id', 'uuid', 'slug', 'collection_abbr', 'name',
            
            # Content fields
            'extent', 'abstract', 'description', 'background', 'conventions',
            'acquisition', 'access_statement', 'related_publications_collections',
            'citation_authors', 'expecting_additions', 'expecting_additions_display',
            
            # Calculated/aggregate fields
            'item_count', 'access_levels', 'access_levels_display',
            'genres', 'genres_display', 'languages', 'language_names',
            'date_range', 'date_range_min', 'date_range_max',
            
            # Metadata
            'added', 'updated', 'modified_by'
        ]
        read_only_fields = [
            'id', 'uuid', 'slug', 'item_count', 'access_levels', 'genres', 
            'languages', 'date_range', 'date_range_min', 'date_range_max',
            'added', 'updated'
        ]
    
    def get_access_levels_display(self, obj):
        """Get display values for access levels"""
        if obj.access_levels:
            from metadata.models import ACCESS_CHOICES
            access_dict = dict(ACCESS_CHOICES)
            return [access_dict.get(level, level) for level in obj.access_levels]
        return []
    
    def get_genres_display(self, obj):
        """Get display values for genres"""
        if obj.genres:
            from metadata.models import GENRE_CHOICES
            genre_dict = dict(GENRE_CHOICES)
            return [genre_dict.get(genre, genre) for genre in obj.genres]
        return []
    
    def get_language_names(self, obj):
        """Get language names for display"""
        return [lang.name for lang in obj.languages.all()]
    
    def get_expecting_additions_display(self, obj):
        """Get display value for expecting_additions boolean"""
        if obj.expecting_additions is None:
            return 'Not specified'
        return 'Yes' if obj.expecting_additions else 'No'


class InternalCollaboratorBatchSerializer(serializers.ModelSerializer):
    """Lightweight Collaborator serializer for batch operations - optimized for speed
    
    This serializer is specifically designed for loading large numbers of collaborators
    into the batch editor. It excludes expensive computed fields and only includes
    the minimal data needed for batch editing.
    """
    
    # Minimal language data - just ID and name for display
    class MinimalLanguoidSerializer(serializers.ModelSerializer):
        class Meta:
            model = Languoid
            fields = ['id', 'name', 'glottocode', 'level_glottolog']
    
    native_languages = MinimalLanguoidSerializer(many=True, read_only=True)
    other_languages = MinimalLanguoidSerializer(many=True, read_only=True)
    
    # Simple boolean display
    anonymous_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Collaborator
        fields = [
            # Core identity fields
            'id', 'uuid', 'slug', 'collaborator_id',
            'full_name', 'first_names', 'last_names', 'name_suffix', 'nickname', 'other_names',
            
            # Privacy
            'anonymous', 'anonymous_display',
            
            # Cultural information
            'clan_society', 'tribal_affiliations', 'origin', 'gender',
            
            # Dates
            'birthdate', 'deathdate',
            
            # Additional information
            'other_info',
            
            # Language relationships (minimal - just for display)
            'native_languages', 'other_languages',
            
            # System metadata
            'modified_by',
            'updated'  # For conflict detection
        ]
        read_only_fields = ['id', 'uuid', 'slug', 'anonymous_display', 'updated']
    
    def get_anonymous_display(self, obj):
        """Return display value for anonymous boolean field"""
        if obj.anonymous is None:
            return 'Not specified'
        return 'Yes' if obj.anonymous else 'No'


class InternalCollaboratorSerializer(serializers.ModelSerializer):
    """Comprehensive Collaborator serializer for internal API - provides full structure for CRUD operations"""
    
    # Display name that respects privacy settings and user permissions
    display_name = serializers.SerializerMethodField()
    
    # Privacy notice for privileged users viewing anonymous collaborators
    privacy_notice = serializers.SerializerMethodField()
    
    # Related items this collaborator is associated with
    associated_items = serializers.SerializerMethodField()
    
    # Language names (simplified for display) - DEPRECATED in favor of full objects
    native_language_names = serializers.SerializerMethodField()
    other_language_names = serializers.SerializerMethodField()
    
    # Language relationships (full objects for editing) - nested serializer for read, IDs for write
    native_languages = serializers.SerializerMethodField()
    other_languages = serializers.SerializerMethodField()
    
    # Boolean field display
    anonymous_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Collaborator
        fields = [
            # Core identity fields
            'id', 'uuid', 'slug', 'collaborator_id',
            'full_name', 'first_names', 'last_names', 'name_suffix', 'nickname', 'other_names',
            
            # Privacy and display
            'anonymous', 'anonymous_display', 'display_name', 'privacy_notice',
            
            # Cultural information
            'clan_society', 'tribal_affiliations', 'origin', 'gender',
            
            # Dates (flexible text fields)
            'birthdate', 'deathdate',
            
            # Additional information
            'other_info',
            
            # Language relationships (simplified display - deprecated but kept for compatibility)
            'native_language_names', 'other_language_names',
            
            # Language relationships (full objects for editing)
            'native_languages', 'other_languages',
            
            # Related data
            'associated_items',
            
            # System metadata
            'added', 'updated', 'modified_by'
        ]
        read_only_fields = ['id', 'uuid', 'slug', 'added', 'updated', 'modified_by', 'display_name', 'privacy_notice', 'associated_items', 'native_language_names', 'other_language_names', 'anonymous_display']
    
    def get_display_name(self, obj):
        """Return appropriate display name based on user permissions and privacy settings"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return f"Anonymous {obj.collaborator_id}"
        
        # Check if user has privileged access (Admin, Archivist, Museum Staff)
        user = request.user
        has_privileged_access = (
            user.is_staff or 
            user.groups.filter(name__in=['Archivist', 'Museum Staff']).exists()
        )
        
        if has_privileged_access:
            # Privileged users see full name regardless of anonymous status
            if obj.first_names and obj.last_names:
                return f"{obj.first_names} {obj.last_names}"
            elif obj.full_name:
                return obj.full_name
            elif obj.first_names:
                return obj.first_names
            elif obj.last_names:
                return obj.last_names
            else:
                return f"Collaborator {obj.collaborator_id}"
        else:
            # Read-only users always see anonymized format
            return f"Anonymous {obj.collaborator_id}"
    
    def get_privacy_notice(self, obj):
        """Return privacy notice for privileged users viewing anonymous collaborators"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        # Check if user has privileged access
        user = request.user
        has_privileged_access = (
            user.is_staff or 
            user.groups.filter(name__in=['Archivist', 'Museum Staff']).exists()
        )
        
        if has_privileged_access and obj.anonymous:
            return {
                'public_display': f"Anonymous {obj.collaborator_id}",
                'message': "This collaborator will appear as 'Anonymous {0}' in public contexts. Personal information will not be shared publicly.".format(obj.collaborator_id)
            }
        
        return None
    
    def get_associated_items(self, obj):
        """Return list of items this collaborator is associated with"""
        # Get items through CollaboratorRole relationships
        from metadata.models import Item
        
        item_roles = obj.collaborator_collaboratorroles.select_related('item', 'item__collection').prefetch_related('item__title_item').filter(item__isnull=False)
        items_data = []
        
        for role in item_roles:
            if role.item:
                # Get primary title using same logic as InternalItemSerializer
                default_title = role.item.title_item.filter(default=True).first()
                if default_title:
                    primary_title = default_title.title
                else:
                    # If no default title, get the first one
                    first_title = role.item.title_item.first()
                    primary_title = first_title.title if first_title else '(No title)'
                
                items_data.append({
                    'id': role.item.id,
                    'catalog_number': role.item.catalog_number,
                    'primary_title': primary_title,
                    'collection_abbr': role.item.collection.collection_abbr if role.item.collection else None,
                    'roles': role.role or []
                })
        
        return items_data
    
    def get_native_language_names(self, obj):
        """Return simplified list of native language names"""
        return [lang.name for lang in obj.native_languages.all()]
    
    def get_other_language_names(self, obj):
        """Return simplified list of other language names"""
        return [lang.name for lang in obj.other_languages.all()]
    
    def get_native_languages(self, obj):
        """Return full Languoid objects for native languages"""
        return InternalLanguoidSerializer(obj.native_languages.all(), many=True).data
    
    def get_other_languages(self, obj):
        """Return full Languoid objects for other languages"""
        return InternalLanguoidSerializer(obj.other_languages.all(), many=True).data
    
    def get_anonymous_display(self, obj):
        """Return display value for anonymous boolean field"""
        if obj.anonymous is None:
            return 'Not specified'
        return 'Yes' if obj.anonymous else 'No'
    
    def create(self, validated_data):
        """
        Custom create to handle M2M fields.
        
        For native_languages and other_languages, we need to:
        1. Extract the M2M data from the initial request data (not validated_data, since they're SerializerMethodFields)
        2. Create the instance first (without M2M fields)
        3. Add the M2M relationships using Django's built-in .set() method
        """
        from metadata.models import Languoid
        
        # Extract M2M field data from initial_data (raw request data)
        # Since native_languages and other_languages are SerializerMethodFields (read-only),
        # they won't be in validated_data. We need to get them from initial_data.
        initial_data = self.initial_data
        native_languages_ids = initial_data.get('native_languages', None)
        other_languages_ids = initial_data.get('other_languages', None)
        
        # Create the instance without M2M fields
        # (modified_by is already in validated_data from perform_create)
        instance = super().create(validated_data)
        
        # Set native_languages M2M relationship
        if native_languages_ids is not None:
            # Use Django's built-in set() method for M2M relationships
            # This will automatically trigger m2m_changed signals
            instance.native_languages.set(native_languages_ids)
        
        # Set other_languages M2M relationship
        if other_languages_ids is not None:
            # Use Django's built-in set() method for M2M relationships
            instance.other_languages.set(other_languages_ids)
        
        return instance
    
    def update(self, instance, validated_data):
        """
        Custom update to handle M2M fields.
        
        For native_languages and other_languages, we need to:
        1. Extract the M2M data from the initial request data (not validated_data, since they're SerializerMethodFields)
        2. Update the regular fields first
        3. Update the M2M relationships using Django's built-in .set() method
        
        Note: modified_by is automatically set by perform_update() in the ViewSet
        """
        from metadata.models import Languoid
        
        # Extract M2M field data from initial_data (raw request data)
        # Since native_languages and other_languages are SerializerMethodFields (read-only),
        # they won't be in validated_data. We need to get them from initial_data.
        initial_data = self.initial_data
        native_languages_ids = initial_data.get('native_languages', None)
        other_languages_ids = initial_data.get('other_languages', None)
        
        # Update the instance with non-M2M fields
        # (modified_by is already handled by perform_update in the ViewSet)
        instance = super().update(instance, validated_data)
        
        # Update native_languages M2M relationship
        if native_languages_ids is not None:
            # Use Django's built-in set() method for M2M relationships
            # This will automatically trigger m2m_changed signals
            instance.native_languages.set(native_languages_ids)
        
        # Update other_languages M2M relationship
        if other_languages_ids is not None:
            # Use Django's built-in set() method for M2M relationships
            instance.other_languages.set(other_languages_ids)
        
        return instance


class InternalLanguoidSerializer(serializers.ModelSerializer):
    """Comprehensive Languoid serializer for internal API following established patterns"""
    
    # Display field for level choice
    level_display = serializers.CharField(source='get_level_nal_display', read_only=True)
    
    # Parent relationship names for hierarchical display
    family_name = serializers.CharField(source='family_languoid.name', read_only=True, allow_null=True)
    family_glottocode = serializers.CharField(source='family_languoid.glottocode', read_only=True, allow_null=True)
    parent_name = serializers.CharField(source='parent_languoid.name', read_only=True, allow_null=True)
    parent_glottocode = serializers.CharField(source='parent_languoid.glottocode', read_only=True, allow_null=True)
    pri_subgroup_name = serializers.CharField(source='pri_subgroup_languoid.name', read_only=True, allow_null=True)
    pri_subgroup_glottocode = serializers.CharField(source='pri_subgroup_languoid.glottocode', read_only=True, allow_null=True)
    sec_subgroup_name = serializers.CharField(source='sec_subgroup_languoid.name', read_only=True, allow_null=True)
    sec_subgroup_glottocode = serializers.CharField(source='sec_subgroup_languoid.glottocode', read_only=True, allow_null=True)
    
    # Child relationship counts for overview display
    child_count = serializers.SerializerMethodField()
    dialect_count = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Languoid
        fields = [
            # Basic identifiers
            'id', 'name', 'name_abbrev', 'iso', 'glottocode', 'level_nal', 'level_glottolog', 'level_display',
            
            # Hierarchy - relationship fields (IDs for editing)
            'family_languoid', 'pri_subgroup_languoid', 'sec_subgroup_languoid',
            'parent_languoid', 'descendents',
            
            # Hierarchy - relationship names (for display)
            'family_name', 'family_glottocode', 'parent_name', 'parent_glottocode', 
            'pri_subgroup_name', 'pri_subgroup_glottocode', 'sec_subgroup_name', 'sec_subgroup_glottocode',
            
            # Additional information
            'alt_names', 'region', 'latitude', 'longitude',
            'tribes', 'notes',
            
            # Calculated fields
            'child_count', 'dialect_count', 'item_count',
            
            # Metadata
            'added', 'updated', 'modified_by'
        ]
        read_only_fields = [
            'id', 'added', 'updated', 'modified_by', 'child_count', 'dialect_count', 'item_count',
            'family_name', 'family_glottocode', 'parent_name', 'parent_glottocode', 
            'pri_subgroup_name', 'pri_subgroup_glottocode', 'sec_subgroup_name', 'sec_subgroup_glottocode'
        ]
    
    def get_child_count(self, obj):
        """Get count of direct child languoids"""
        return obj.child_languoids.count()
    
    def get_dialect_count(self, obj):
        """Get count of dialects for languages"""
        if obj.level_nal == 'language':
            # Count child languoids that are dialects
            return obj.child_languoids.filter(level_nal='dialect').count()
        return 0
    
    def get_item_count(self, obj):
        """Get count of items associated with this languoid"""
        return obj.item_languages.count()
    
    def validate_glottocode(self, value):
        """Validate glottocode format (8 characters, last 4 numeric)"""
        if value and (len(value) != 8 or not value[-4:].isdigit()):
            raise serializers.ValidationError(
                'Glottocode must be 8 characters with the last 4 being numeric.'
            )
        return value
    
    def create(self, validated_data):
        """Create new languoid with user tracking"""
        import logging
        logger = logging.getLogger(__name__)
        
        request = self.context.get('request')
        logger.info(f"Serializer create() called. Request: {request}")
        logger.info(f"Request user: {getattr(request, 'user', None)}")
        logger.info(f"Has user attr: {hasattr(request, 'user')}")
        
        if request and hasattr(request, 'user'):
            validated_data['modified_by'] = str(request.user)
            logger.info(f"Set modified_by to: {validated_data['modified_by']}")
        else:
            logger.warning("No request or user found in context!")
            
        logger.info(f"Final validated_data: {validated_data}")
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update instance with user tracking"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['modified_by'] = str(request.user)
        return super().update(instance, validated_data)


class InternalCollaboratorRoleSerializer(serializers.ModelSerializer):
    """
    Serializer for CollaboratorRole - handles Item-Collaborator relationships with roles.
    
    Used for reading existing roles and creating/updating roles in the editable collaborator field.
    """
    # Include full collaborator data for display
    collaborator_data = serializers.SerializerMethodField()
    
    # MultiSelectField for roles - writable as list
    role = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    
    # Display values for roles
    role_display = serializers.SerializerMethodField()
    
    class Meta:
        model = CollaboratorRole
        fields = [
            'id',
            'collaborator',  # ID for writing
            'collaborator_data',  # Full object for display
            'role',  # List of role values
            'role_display',  # Human-readable role labels
            'citation_author',
            'modified_by',
            'updated'
        ]
        read_only_fields = ['id', 'collaborator_data', 'role_display', 'modified_by', 'updated']
    
    def get_collaborator_data(self, obj):
        """Return full collaborator object for display"""
        from metadata.models import Collaborator
        collaborator = obj.collaborator
        
        # Use the same display logic as InternalCollaboratorSerializer
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            display_name = f"Anonymous {collaborator.collaborator_id}"
        else:
            user = request.user
            has_privileged_access = (
                user.is_staff or 
                user.groups.filter(name__in=['Archivist', 'Museum Staff']).exists()
            )
            
            if has_privileged_access:
                if collaborator.first_names and collaborator.last_names:
                    display_name = f"{collaborator.first_names} {collaborator.last_names}"
                elif collaborator.full_name:
                    display_name = collaborator.full_name
                elif collaborator.first_names:
                    display_name = collaborator.first_names
                elif collaborator.last_names:
                    display_name = collaborator.last_names
                else:
                    display_name = f"Collaborator {collaborator.collaborator_id}"
            else:
                display_name = f"Anonymous {collaborator.collaborator_id}"
        
        return {
            'id': collaborator.id,
            'collaborator_id': collaborator.collaborator_id,
            'display_name': display_name,
            'full_name': collaborator.full_name,
            'slug': collaborator.slug,
        }
    
    def get_role_display(self, obj):
        """Get human-readable role labels"""
        if not obj.role:
            return []
        
        from metadata.models import ROLE_CHOICES
        role_dict = dict(ROLE_CHOICES)
        
        return [role_dict.get(role_value, role_value) for role_value in obj.role]
