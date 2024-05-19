import re
from django import forms
from django.core.exceptions import ValidationError
from django.forms import ModelForm
from django.forms.widgets import CheckboxSelectMultiple
from django.db.models import Max
from .models import Item, ItemTitle, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video

class LanguageForm(ModelForm):
    class Meta:
        model = Language
        fields = ['name',
                  'alt_name',
                  'glottocode',
                  'iso',
                  'level',
                  'family',
                  'family_id',
                  'family_abbrev',
                  'pri_subgroup',
                  'pri_subgroup_id',
                  'pri_subgroup_abbrev',
                  'sec_subgroup',
                  'sec_subgroup_id',
                  'sec_subgroup_abbrev',
                  'region',
                  'latitude',
                  'longitude',
                  'dialects',
                  'dialects_ids',
                  'tribes',
                  'notes']
    def clean_glottocode(self):
        return self.validate_glottocode_field('glottocode')

    def clean_family_id(self):
        return self.validate_glottocode_field('family_id', "Family glottocode")

    def clean_pri_subgroup_id(self):
        return self.validate_glottocode_field('pri_subgroup_id', "Primary subgroup glottocode")

    def clean_sec_subgroup_id(self):
        return self.validate_glottocode_field('sec_subgroup_id', "Secondary subgroup glottocode")
    
    def validate_glottocode_field(self, field_name, display_name=None):
        field_value = self.cleaned_data.get(field_name)

        # If the field value is blank, return it without validation
        if not field_value:
            return field_value
    
        if not display_name:
            display_name = field_name
        if len(field_value) != 8 or not re.match(r'^.*\d{4}$', field_value):
            raise ValidationError(f'{display_name.capitalize()} must be a string of 8 characters and the last 4 characters must be numeric.')

        return field_value
    
    def clean_dialects_ids(self):
        dialects_ids = self.cleaned_data.get('dialects_ids')

        # If the field value is blank, return it without validation
        if not dialects_ids:
            return dialects_ids

        # Split the field value by comma and strip spaces
        glottocodes = [code.strip() for code in dialects_ids.split(',')]

        # Validate each glottocode
        for glottocode in glottocodes:
            if len(glottocode) != 8 or not re.match(r'^.*\d{4}$', glottocode):
                raise ValidationError('Dialect glottocodes must be a comma separated list of strings of text with 8 characters and the last 4 characters must be numeric.')

        return dialects_ids
    
    def save(self, commit=True, *args, **kwargs):
        modified_by = kwargs.pop('modified_by', None)
        instance = super().save(commit=False, *args, **kwargs)
        instance.modified_by = modified_by
        if commit:
            instance.save()
        return instance
    
class DialectForm(ModelForm):
    class Meta:
        model = Dialect
        fields = ['name']

class DialectInstanceForm(ModelForm):
    class Meta:
        model = DialectInstance
        fields = ['name']
    def __init__(self, *args, **kwargs):
        super(DialectInstanceForm, self).__init__(*args, **kwargs)
        self.fields['name'].widget = CheckboxSelectMultiple()
        self.fields['name'].queryset = Dialect.objects.filter(language=self.instance.language)


class CollaboratorForm(ModelForm):
    class Meta:
        model = Collaborator
        fields = ['collaborator_id',
                  'name',
                  'nickname',
                  'other_names',
                  'anonymous',
                  'native_languages',
                  'other_languages',
                  'clan_society',
                  'tribal_affiliations',
                  'origin',
                  'birthdate',
                  'deathdate',
                  'gender',
                  'other_info']
    def __init__(self, *args, **kwargs):
        super(CollaboratorForm, self).__init__(*args, **kwargs)
        collaborator_next_id = Collaborator.objects.all().aggregate(Max('collaborator_id'))['collaborator_id__max'] + 1
        print(collaborator_next_id)
        self.fields['collaborator_id'].initial = collaborator_next_id

class CollaboratorRoleForm(ModelForm):
    class Meta:
        model = CollaboratorRole
        fields = ['role']

class GeographicForm(ModelForm):
    class Meta:
        model = Geographic
        fields = ['lat', 'long']

class ItemForm(ModelForm):
    collaborator = forms.ModelMultipleChoiceField(Collaborator.objects.order_by('name'), required=False)
    class Meta:
        model = Item
        fields = ['catalog_number',
                  'item_access_level',
                  'call_number',
                  'accession_date',
                  'additional_digital_file_location',
                  'indigenous_title',
                  'english_title',
                  'general_content',
                  'language',
                  'creation_date',
                  'description_scope_and_content',
                  'genre',
                  'associated_ephemera',
                  'access_level_restrictions',
                  'copyrighted_notes',
                  'permission_to_publish_online',
                  'collaborator',
                  'language_description_type',
                  'availability_status',
                  'availability_status_notes',
                  'condition',
                  'condition_notes',
                  'ipm_issues',
                  'conservation_treatments_performed',
                  'accession_number',
                  'accession_date',
                  'type_of_accession',
                  'acquisition_notes',
                  'project_grant',
                  'collection_name',
                  'collector_name',
                  'collector_info',
                  'collectors_number',
                  'collection_date',
                  'collecting_notes',
                  'depositor_name',
                  'depositor_contact_information',
                  'deposit_date',
                  'municipality_or_township',
                  'county_or_parish',
                  'state_or_province',
                  'country_or_territory',
                  'global_region',
                  'recording_context',
                  'public_event',
                  'original_format_medium',
                  'recorded_on',
                  'equipment_used',
                  'software_used',
                  'conservation_recommendation',
                  'location_of_original',
                  'other_information',
                  'publisher',
                  'publisher_address',
                  'isbn',
                  'loc_catalog_number',
                  'total_number_of_pages_and_physical_description',
                  'temporary_accession_number',
                  'lender_loan_number',
                  'other_institutional_number',
                  'migration_file_format',
                  'migration_location',
                  'digital_file_location',
                  'cataloged_by',
                  'cataloged_date',
                  'filemaker_legacy_pk_id']


class ItemTitleForm(ModelForm):
    class Meta:
        model = ItemTitle
        fields = ['title', 'language']

class Columns_exportForm(ModelForm):
    class Meta:
        model = Columns_export
        fields = ['name',
                  'item_catalog_number',
                  'item_item_access_level',
                  'item_call_number',
                  'item_accession_date',
                  'item_additional_digital_file_location',
                  'item_indigenous_title',
                  'item_english_title',
                  'item_general_content',
                  'item_language',
                  'item_dialect',
                  'item_creation_date',
                  'item_description_scope_and_content',
                  'item_genre',
                  'item_associated_ephemera',
                  'item_document_filename',
                  'item_document_filetype',
                  'item_document_access_level',
                  'item_document_enumerator',
                  'item_document_title',
                  'item_document_duration',
                  'item_document_filesize',
                  'item_document_av_spec',
                  'item_document_creation_date',
                  'item_document_language',
                  'item_document_dialect',
                  'item_document_collaborator',
                  'item_document_collaborator_role',
                  'item_document_geographic_lat_long',
                  'item_access_level_restrictions',
                  'item_copyrighted_notes',
                  'item_permission_to_publish_online',
                  'item_collaborator',
                  'item_collaborator_role',
                  'item_language_description_type',
                  'item_availability_status',
                  'item_availability_status_notes',
                  'item_condition',
                  'item_condition_notes',
                  'item_ipm_issues',
                  'item_conservation_treatments_performed',
                  'item_accession_number',
                  'item_accession_date',
                  'item_type_of_accession',
                  'item_acquisition_notes',
                  'item_project_grant',
                  'item_collection_name',
                  'item_collector_name',
                  'item_collector_info',
                  'item_collectors_number',
                  'item_collection_date',
                  'item_collecting_notes',
                  'item_depositor_name',
                  'item_depositor_contact_information',
                  'item_deposit_date',
                  'item_municipality_or_township',
                  'item_county_or_parish',
                  'item_state_or_province',
                  'item_country_or_territory',
                  'item_global_region',
                  'item_recording_context',
                  'item_public_event',
                  'item_geographic_lat_long',
                  'item_original_format_medium',
                  'item_recorded_on',
                  'item_equipment_used',
                  'item_software_used',
                  'item_conservation_recommendation',
                  'item_location_of_original',
                  'item_other_information',
                  'item_publisher',
                  'item_publisher_address',
                  'item_isbn',
                  'item_loc_catalog_number',
                  'item_total_number_of_pages_and_physical_description',
                  'item_temporary_accession_number',
                  'item_lender_loan_number',
                  'item_other_institutional_number',
                  'item_migration_file_format',
                  'item_migration_location',
                  'item_digital_file_location',
                  'item_cataloged_by',
                  'item_cataloged_date',
                  'item_filemaker_legacy_pk_id',
                  'item_updated',
                  'item_modified_by',
                  'item_added']

#########################

class DialectInstanceCustomForm(ModelForm):

    OPTIONS = [
        ("0", "ALL"),
        ("1", "New York"),
        ("2", "Los Angeles"),
        ]
    dialects = forms.MultipleChoiceField(
                        choices=(),
                        required=False,
                        widget=forms.CheckboxSelectMultiple,)

    class Meta:
        model = DialectInstance
        fields = ['dialects']

        def __init__(self, *args, **kwargs):

            super(DialectInstanceCustomForm, self).__init__(*args, **kwargs)
            self.fields['dialects'] = Item.objects.filter(catalog_number__icontains='s')


###########################################

class Columns_export_choiceForm(forms.Form):
    settings = Columns_export.objects.values_list('name', flat=True)

class Csv_format_type(forms.Form):
    CHOICES=[('public','Public facing'),
             ('private','Private facing'),
             ('custom','Custom:')]

    type = forms.ChoiceField(label=("Choose CSV header type"),
                             choices=CHOICES,
                             initial=("public"),
                             widget=forms.RadioSelect)

class DocumentForm(ModelForm):
    collaborator = forms.ModelMultipleChoiceField(Collaborator.objects.order_by('name'), required=False)
    class Meta:
        model = Document
        fields = ['filename',
                  'filetype',
                  'access_level',
                  'enumerator',
                  'title',
                  'duration',
                  'filesize',
                  'av_spec',
                  'creation_date',
                  'language',
                  'collaborator',
                  'item']

class VideoForm(ModelForm):
    class Meta:
        model = Video
        fields = ['file']

class UploadDocumentForm(forms.Form):
    file = forms.FileField(widget=forms.ClearableFileInput(attrs={'multiple': True}))
