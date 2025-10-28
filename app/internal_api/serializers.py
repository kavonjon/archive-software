"""
Internal API serializers for React frontend
Simplified, flat structure optimized for frontend consumption
"""
from rest_framework import serializers
from metadata.models import Item, Collection, Collaborator, Languoid, ItemTitle


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
    
    # Language names (simplified)
    language_names = serializers.SerializerMethodField()
    
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
    
    # MultiSelectField display values
    genre_display = serializers.SerializerMethodField()
    language_description_type_display = serializers.SerializerMethodField()
    
    # Boolean field display
    permission_to_publish_online_display = serializers.SerializerMethodField()
    migrate_display = serializers.SerializerMethodField()
    
    # Description (using the correct field name)
    description = serializers.CharField(source='description_scope_and_content', required=False, allow_blank=True)
    
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
            'country_or_territory', 'global_region', 'recording_context', 'public_event',
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
        read_only_fields = ['id', 'uuid', 'slug', 'added', 'updated']
    
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
    
    def get_collaborator_names(self, obj):
        """Get simple list of collaborator names"""
        return [collab.name for collab in obj.collaborator.all()]
    
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


class InternalCollaboratorSerializer(serializers.ModelSerializer):
    """Comprehensive Collaborator serializer for internal API - provides full structure for CRUD operations"""
    
    # Display name that respects privacy settings and user permissions
    display_name = serializers.SerializerMethodField()
    
    # Privacy notice for privileged users viewing anonymous collaborators
    privacy_notice = serializers.SerializerMethodField()
    
    # Related items this collaborator is associated with
    associated_items = serializers.SerializerMethodField()
    
    # Language names (simplified for display)
    native_language_names = serializers.SerializerMethodField()
    other_language_names = serializers.SerializerMethodField()
    
    # Boolean field display
    anonymous_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Collaborator
        fields = [
            # Core identity fields
            'id', 'uuid', 'slug', 'collaborator_id',
            'name', 'firstname', 'lastname', 'nickname', 'other_names',
            
            # Privacy and display
            'anonymous', 'anonymous_display', 'display_name', 'privacy_notice',
            
            # Cultural information
            'clan_society', 'tribal_affiliations', 'origin', 'gender',
            
            # Dates (flexible text fields)
            'birthdate', 'deathdate',
            
            # Additional information
            'other_info',
            
            # Language relationships (simplified display)
            'native_language_names', 'other_language_names',
            
            # Related data
            'associated_items',
            
            # System metadata
            'added', 'updated', 'modified_by'
        ]
        read_only_fields = ['id', 'uuid', 'slug', 'added', 'updated', 'display_name', 'privacy_notice', 'associated_items', 'native_language_names', 'other_language_names', 'anonymous_display']
    
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
            if obj.firstname and obj.lastname:
                return f"{obj.firstname} {obj.lastname}"
            elif obj.name:
                return obj.name
            elif obj.firstname:
                return obj.firstname
            elif obj.lastname:
                return obj.lastname
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
    
    def get_anonymous_display(self, obj):
        """Return display value for anonymous boolean field"""
        if obj.anonymous is None:
            return 'Not specified'
        return 'Yes' if obj.anonymous else 'No'


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
            'child_count', 'dialect_count',
            
            # Metadata
            'added', 'updated', 'modified_by'
        ]
        read_only_fields = [
            'id', 'added', 'updated', 'modified_by', 'child_count', 'dialect_count',
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
