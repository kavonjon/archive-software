import re
from django.db import models
from django.urls import reverse
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericRelation
from django.db.models.signals import post_delete
from django.dispatch import receiver
#from django.utils.six import python_2_unicode_compatible
from multiselectfield import MultiSelectField
#from django_date_extensions.fields import ApproximateDateField
#from approx_dates.models import ApproxDate
from video_encoding.fields import VideoField
from video_encoding.models import Format



ACCESS_CHOICES = (('1', '1 - Open Access'),
                  ('2', '2 - Materials are available to view onsite but no copies may be distributed'),
                  ('3', '3 - Access protected by a time limit'),
                  ('4', '4 - Depositor (or someone else) controls access to the resource'))

ACCESSION_CHOICES = (('conversion', 'Conversion'),
                     ('transfer', 'Exchange/Transfer'),
                     ('field', 'Field Collection'),
                     ('found', 'Found in Collection/Conversion'),
                     ('gift', 'Gift'),
                     ('purchase', 'Purchase'),
                     ('reproduction', 'Reproduction'))

AVAILABILITY_CHOICES = (('available', 'available'),
                        ('restrictions', 'restrictions apply'),
                        ('missing_parts', 'missing parts'),
                        ('missing', 'missing'))

CONDITION_CHOICES = (('excellent', 'Excellent'),
                     ('good', 'Good'),
                     ('fragile', 'Fragile'),
                     ('fair', 'Fair'),
                     ('poor', 'Poor'))

CONTENT_CHOICES = (('audio', 'Audio'),
                   ('audio-video', 'Audio/Video'),
                   ('publication_book', 'Publication: Book'),
                   ('manuscript', 'Manuscript'),
                   ('ephemera', 'Ephemera'),
                   ('website', 'Website'))

CONTENT_CHOICES = (('3d_object', '3D Object'),
                   ('audio', 'Audio'),
                   ('audio-video', 'Audio/Video'),
                   ('book', 'Book'),
                   ('dataset', 'Dataset'),
                   ('ephemera', 'Ephemera'),
                   ('image', 'Image (Photograph)'),
                   ('manuscript', 'Manuscript'),
                   ('multimedia', 'Multimedia'),
                   ('other', 'Other'),
                   ('publication_article', 'Publication: Journal Article'),
                   ('publication_book', 'Publication: Book'),
                   ('publication_chapter', 'Publication: Book chapter'),
                   ('publication_other', 'Publication (other)'),
                   ('publication_thesis', 'Publication: Thesis'),
                   ('website', 'Website'))

FORMAT_CHOICES = (('audio_cd', 'audio CD'),
                  ('audio_reel', 'audio reel'),
                  ('book', 'book'),
                  ('cassette', 'cassette'),
                  ('cd', 'CD'),
                  ('cd_dvd', 'CD-DVD'),
                  ('dat', 'DAT'),
                  ('cd_r', 'data CD (CD-R)'),
                  ('dv_r', 'data DVD (DV-R)'),
                  ('diskette', 'diskette'),
                  ('dvd', 'DVD'),
                  ('ephemera', 'ephemera'),
                  ('garment', 'garment'),
                  ('hi_8', 'hi-8'),
                  ('manuscript', 'manuscript'),
                  ('microcassette', 'microcassette'),
                  ('mini_DV', 'mini-DV'),
                  ('other', 'other'),
                  ('phonograph_record', 'phonograph record'),
                  ('reel_to_reel', 'reel-to-reel'),
                  ('vhs', 'VHS'),
                  ('video_reel', 'video reel'))

GENRE_CHOICES = (('49', '49'),
                 ('article', 'Article'),
                 ('book', 'Book'),
                #  ('ceremony', 'Ceremony'), # SLATED FOR DELETION
                 ('ceremonial', 'Ceremonial'),
                #  ('chant', 'Chant'), # SLATED FOR DELETION
                 ('conversation', 'Conversation'),
                 ('correspondence', 'Correspondence'),
                #  ('curse', 'Curse'), # SLATED FOR DELETION
                 ('dataset', 'Dataset'),
                #  ('debate', 'Debate'), # SLATED FOR DELETION
                #  ('description', 'Description'),
                 ('document', 'Document'), #possibly deprecated
                 ('drama', 'Drama'),
                 ('educational', 'Educational material'),
                 ('educational_material_family', 'Educational materials - Family'),
                 ('educational_material_learners', 'Educational materials - For learners'),
                 ('educational_material_teachers', 'Educational materials - For teachers'),
                 ('educational_materials_planning', 'Educational materials - Language planning'),
                 ('elicitation', 'Elicitation'),
                 ('ethnography', 'Ethnography'),
                #  ('field_notes', 'Field notes'),
                 ('for_children', 'For children'),
                #  ('grammar', 'Grammar'),
                #  ('greeting', 'Greeting/Leave-taking'), # SLATED FOR DELETION
                 ('hand_game', 'Hand game'),
                 ('history', 'History'),
                 ('hymn', 'Hymn'),
                #  ('instructions', 'Instructions'), # SLATED FOR DELETION
                #  ('instrumental', 'Instrumental music'), # SLATED FOR DELETION
                 ('interview', 'Interview'),
                #  ('lexicon', 'Lexicon'),
                #  ('meeting', 'Meeting'), # SLATED FOR DELETION
                 ('music', 'Music'),
                #  ('myth', 'Myth'),
                 ('narrative', 'Narrative'),
                 ('native_american_church', 'Native American Church'),
                 ('oratory', 'Oratory'),
                 ('photograph', 'Photograph'),
                 ('poetry', 'Poetry'),
                 ('popular_production', 'Popular production'),
                 ('powwow', 'Powwow'),
                 ('prayer', 'Prayer'),
                 ('procedural', 'Procedural'),
                #  ('procedure', 'Procedure'), # rename in separate migration
                #  ('proverb', 'Proverb'), # rename in separate migration
                #  ('reader', 'Reader'),
                #  ('recipe', 'Recipe'), # SLATED FOR DELETION
                #  ('ritual', 'Ritual song'),
                 ('round_dance', 'Round dance'),
                 ('saying_proverb', 'Saying or Proverb'),
                #  ('sketch', 'Sketch'),
                #  ('song', 'Song'),
                 ('speech', 'Speech play'),
                 ('stomp_dance', 'Stomp dance'),
                 ('sundance', 'Sundance'),
                 ('textbook', 'Textbook'),
                 ('thesis', 'Thesis'),
                 ('traditional_story', 'Traditional story'),
                 ('transcript', 'Transcript'),
                 ('translation', 'Translation'),
                 ('unintelligible', 'Unintelligible speech'),
                 ('war_dance', 'War dance'))
                #  ('wordlist', 'Wordlist'))

MONTH_CHOICES = (('01', 'January'),
                 ('02', 'February'),
                 ('03', 'March'),
                 ('04', 'April'),
                 ('05', 'May'),
                 ('06', 'June'),
                 ('07', 'July'),
                 ('08', 'August'),
                 ('09', 'September'),
                 ('10', 'October'),
                 ('11', 'November'),
                 ('12', 'December'))

ROLE_CHOICES = (('annotator', 'Annotator'),
                ('author', 'Author'),
                ('collector', 'Collector'),
                ('compiler', 'Compiler'),
                ('consultant', 'Consultant'),
                ('data_inputter', 'Data inputter'),
                ('editor', 'Editor'),
                ('filmer', 'Filmer'),
                ('illustrator', 'Illustrator'),
                ('interlocutor', 'Interlocutor'),
                ('interpreter', 'Interpreter'),
                ('interviewer', 'Interviewer'),
                ('performer', 'Performer'),
                ('photographer', 'Photographer'),
                ('publisher', 'Publisher'),
                ('recorder', 'Recorder'),
                ('research_participant', 'Research participant'),
                ('researcher', 'Researcher'),
                ('responder', 'Responder'),
                ('signer', 'Signer'),
                ('speaker', 'Speaker'),
                ('sponsor', 'Sponsor'),
                ('transcriber', 'Transcriber'),
                ('translator', 'Translator'))

# MUSIC_CHOICES = (('ceremonial', 'Ceremonial'),
#                  ('war_dance', 'War dance'),
#                  ('round_dance', 'Round dance'),
#                  ('stomp_dance', 'Stomp dance'),
#                  ('49', '49'),
#                  ('sundance', 'Sundance'),
#                  ('powwow', 'Powwow'),
#                  ('hand_game', 'Hand game'),
#                  ('nac', 'NAC'),
#                  ('hymns', 'Hymns'),
#                  ('children', 'Children'))

LANGUAGE_DESCRIPTION_CHOICES = (('primary-text', 'Primary text'),
                                ('primary-text-igt', 'Primary text: IGT'),
                                ('grammar', 'Grammar'),
                                ('grammar-sketch', 'Grammar: Sketch'),
                                ('grammar-specific-feature', 'Grammar: Specific feature'),
                                ('lexicon', 'Lexicon'),
                                ('lexicon-dictionary', 'Lexicon: Dictionary'),
                                ('lexicon-wordlist', 'Lexicon: Wordlist'),
                                ('transcript', 'Transcript'),
                                ('translation', 'Translation'),
                                ('comparative', 'Comparative'),
                                ('fieldnotes', 'Field notes'),
                                ('transcribed_texts', 'Transcribed texts'))



def reverse_lookup_choices(choices, entry):
    for choice in list(choices):
        human_readable_text = choice[1].replace('(', '\(').replace(')', '\)') # need parentheses to be escaped
        computer_readable_text = choice[0]
        entry = re.sub(human_readable_text, computer_readable_text, str(entry), flags=re.I) # re.I ignores case
    return entry
####need validation on import, because right now with this replace function, it will input anything that is below char limit, and admin wont display anything
####but change will need to continue to support multiselectfield as well


def validate_date_text(value):
    if value == "":
#        print(value + " got to Z")
        return value
    date_re = re.search(r"([0-9]{4})([0-9]{4})", str(value), flags=re.I)
    if date_re:
#        print(value + " got to A")
        return date_re.group(1)+'-'+date_re.group(2)
    date_re = re.search(r"([0-9]+[a-z]{2} century\?*)", str(value), flags=re.I)
    if date_re:
#        print(value + " got to B")
        return date_re.group(1)
    date_re = re.search(r"([0-9]{4})['’]*(s\?*)", str(value), flags=re.I)
    if date_re:
#        print(value + " got to C")
        return date_re.group(1)+date_re.group(2)
    if not re.search(r"([0-9]{4})", str(value), flags=re.I): # no date assignment because there is no 4-digit year
        raise ValidationError(_('Invalid format for date entry'), code='invalid')

    date_re = re.search(r"^([0-9]{4}\?)$", str(value), flags=re.I)
    if date_re:
#        print(value + " got to C")
        return date_re.group(1)
    date_re = re.search(r"(ca *[0-9]{4})", str(value), flags=re.I)
    if date_re:
#        print(value + " got to D")
        return date_re.group(1)
    date_re = re.search(r"([0-9]{1,2}/[0-9]{1,2}/[0-9]{4}-[0-9]{1,2}/[0-9]{1,2}/[0-9]{4})", str(value), flags=re.I)
    if date_re:
#        print(value + " got to D")
        return date_re.group(1)
    date_re = re.search(r"([0-9]{1,2}/[0-9]{4}-[0-9]{1,2}/[0-9]{4})", str(value), flags=re.I)
    if date_re:
#        print(value + " got to E")
        return date_re.group(1)
    date_re = re.search(r"^([0-9]{4})$", str(value), flags=re.I)
    if date_re:
#        print(value + " got to F")
        return date_re.group(1)
    date_re = re.search(r"^([0-9]{4}-[0-9]{4})$", str(value), flags=re.I)
    if date_re:
#        print(value + " got to G")
        return date_re.group(1)

    value = reverse_lookup_choices(MONTH_CHOICES, str(value)) # convert alpha months to numeric
    value = re.sub(r"^(\d)([\s\D])", r"0\g<1>\g<2>", value) # add leading zeros to an single digit number, part 1 (exception for beginning of line)
    value = re.sub(r"([\s\D])(\d)([\s\D])", r"\g<1>0\g<2>\g<3>", value) # add leading zeros to an single digit number, part 2 (main)
    value = re.sub(r"([\s\D])(\d)$", r"\g<1>0\g<2>" r"\1\\0\2", value) # add leading zeros to an single digit number, part 3 (exception for end of line)
    if not ( re.search(r"^([0-9]{2})[\s\D]", str(value), flags=re.I) or re.search(r"[\s\D]([0-9]{2})[\s\D]", str(value), flags=re.I) or re.search(r"[\s\D]([0-9]{2})$", str(value), flags=re.I) ):
        if re.search(r"[a-z?]", value, flags=re.I): # if it's only years, and if there are any words or question marks (i.e. weirdness), this date is invalid
            raise ValidationError(_('Invalid format for date entry'), code='invalid')
        date_re = re.sub(r"[,\;\-]", ",", str(value))
        date_re = re.sub(" ", "", date_re)
        date_re = date_re.split(",")
#        print(value + " got to H")
        return min(date_re)+'-'+max(date_re)

    value = re.sub(r"([0-9]{4})[ ,\;\-]*([0-9]{4})", r"\1-\2", str(value))
    value = re.sub(r"([0-9]{1,2})[a-z]+", r"\1", value) # remove any "st" "nd" "rd" "th" from numbers
    value = re.sub(",", "", value) # get rid of commas that might be used in a verbose date format
    value = re.sub(" ", "/", value) # convert spaces to date format (spaces from a verbose date format)
    value = re.sub(r"/([0-9]{1})/", r"0\1", value) # add leading zeros
    if re.search(r"[a-z?]", value, flags=re.I): # at this point, if there are any words left (or question marks), this date is invalid
        raise ValidationError(_('Invalid format for date entry'), code='invalid')

    if len(re.findall("-", value)) <= 1:
        if len(re.findall("-", value)) == 1: # if date has range
            date_1 = re.sub(r"([0-9]+)-([0-9]+)", r"\1", value) # make first date in range
            date_2 = re.sub(r"([0-9]+)-([0-9]+)", r"\2", value) # make second date in range
            value = date_1 + '-' + date_2
#        print(value + " got to I")
        return value
#    print(value + " got to end")
    raise ValidationError(_('Invalid format for date entry'), code='invalid')


class Language(models.Model):
    LEVELS = (('family', 'Family'),
            ('language', 'Language'),
            ('dialect', 'dialect'))
    glottocode = models.CharField(max_length=8, blank=True)
    iso = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=255)
    level = models.CharField(max_length=8, choices=LEVELS)
    family = models.CharField(max_length=255, blank=True)
    family_id = models.CharField(max_length=8, blank=True, verbose_name='Family glottocode')
    family_abbrev = models.CharField(max_length=255, blank=True, verbose_name='Family abbreviation')
    pri_subgroup = models.CharField(max_length=255, blank=True, verbose_name='Primary subgroup')
    pri_subgroup_id = models.CharField(max_length=8, blank=True, verbose_name='Primary subgroup glottocode')
    pri_subgroup_abbrev = models.CharField(max_length=255, blank=True, verbose_name='Primary subgroup abbreviation')
    sec_subgroup = models.CharField(max_length=255, blank=True, verbose_name='Secondary subgroup')
    sec_subgroup_id = models.CharField(max_length=8, blank=True, verbose_name='Secondary subgroup glottocode')
    sec_subgroup_abbrev = models.CharField(max_length=255, blank=True, verbose_name='Secondary subgroup abbreviation')
    alt_name = models.CharField(max_length=255, blank=True, verbose_name='Alternate names')
    region = models.CharField(max_length=255, blank=True)
    longitude = models.DecimalField(max_digits=22, decimal_places=16, blank=True, null=True)
    latitude = models.DecimalField(max_digits=22, decimal_places=16, blank=True, null=True)
    dialects = models.CharField(max_length=255, blank=True)
    dialects_ids = models.CharField(max_length=255, blank=True, verbose_name='Dialect glottocodes')
    language = models.CharField(max_length=255, blank=True)
    language_id = models.CharField(max_length=8, blank=True)
    tribes = models.CharField(max_length=255, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    class Meta:
        ordering = ['name']
    def __str__(self):
        return self.name

class Dialect(models.Model):
    language = models.ForeignKey('Language', related_name='language_dialects', on_delete=models.CASCADE)
    name = models.CharField(max_length=255, verbose_name='Dialect name')
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    class Meta:
        ordering = ['name']
    def __str__(self):
        return self.name


class DialectInstance(models.Model):
    document = models.ForeignKey('Document', related_name='document_dialectinstances', on_delete=models.CASCADE, null=True, blank=True)
    item = models.ForeignKey('Item', related_name='item_dialectinstances', on_delete=models.CASCADE, null=True, blank=True)
    collaborator_native = models.ForeignKey('Collaborator', related_name='collaborator_native_languages_dialectinstances', on_delete=models.CASCADE, null=True, blank=True)
    collaborator_other = models.ForeignKey('Collaborator', related_name='collaborator_other_languages_dialectinstances', on_delete=models.CASCADE, null=True, blank=True)
    language = models.ForeignKey('Language', related_name='language_dialectinstances', on_delete=models.CASCADE)
    name = models.ManyToManyField(Dialect, verbose_name="dialect for this language", related_name='dialectinstance_dialects', blank=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    def __str__(self):
        return '{self.pk}'.format(self=self)
    @property
    def dialect_choices(self):
        return self.language_dialectinstance_language

class Collaborator(models.Model):
    anonymous = models.BooleanField(null=True, blank=True)
    birthdate = models.DateField(null=True, blank=True)
    birthdate = models.CharField(max_length=255, blank=True, validators =[validate_date_text])
    birthdate_min = models.DateField(null=True, blank=True)
    birthdate_max = models.DateField(null=True, blank=True)
    clan_society = models.CharField(max_length=255, blank=True)
    collaborator_id = models.IntegerField(unique=True)
    deathdate = models.CharField(max_length=255, blank=True, validators =[validate_date_text])
    deathdate_min = models.DateField(null=True, blank=True)
    deathdate_max = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=255, blank=True) # old name: sex, need to import
    name = models.CharField(max_length=255, blank=True)
    native_languages = models.ManyToManyField(Language, through='DialectInstance', through_fields=('collaborator_native', 'language'), verbose_name="Native/First languages", related_name='collaborator_native_languages', blank=True)
    nickname = models.CharField(max_length=255, blank=True)
    origin = models.CharField(max_length=255, blank=True)
    other_info = models.TextField(blank=True)
    other_languages = models.ManyToManyField(Language, through='DialectInstance', through_fields=('collaborator_other', 'language'), verbose_name="Other languages", related_name='collaborator_other_languages', blank=True)
    other_names = models.CharField(max_length=255, blank=True)
    tribal_affiliations = models.CharField(max_length=255, blank=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
#    class Meta:
#        ordering = ['name']
    def __str__(self):
        return self.name
    def clean(self):
        self.birthdate = validate_date_text(self.birthdate)
        self.deathdate = validate_date_text(self.deathdate)

class CollaboratorName(models.Model):
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255, blank=True)
    suffix = models.CharField(max_length=255, blank=True)
    primary = models.BooleanField(default=True)
    collaborator = models.ForeignKey('Collaborator', related_name='collaborator_names', on_delete=models.CASCADE)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    class Meta:
        ordering = ['collaborator', 'first_name']
    def __str__(self):
        return self.first_name

class Geographic(models.Model):
    lat = models.DecimalField(max_digits=22, decimal_places=16, verbose_name="latitude")
    long = models.DecimalField(max_digits=22, decimal_places=16, verbose_name="longitude")
    document = models.ForeignKey('Document', related_name='document_geographic', on_delete=models.CASCADE, null=True, blank=True)
    item = models.ForeignKey('Item', related_name='item_geographic', on_delete=models.CASCADE, null=True, blank=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    # class Meta:
    #     ordering = ['-lat']
    # def __str__(self):
    #     return str(self.lat)

class Item(models.Model):
    access_level_restrictions = models.TextField(blank=True)
    accession_date = models.CharField(max_length=255, blank=True, validators =[validate_date_text])
    accession_date_min = models.DateField(null=True, blank=True)
    accession_date_max = models.DateField(null=True, blank=True)
    accession_number = models.CharField(max_length=255, blank=True)
    acquisition_notes = models.TextField(blank=True)
    additional_digital_file_location = models.CharField(max_length=255, blank=True) # to be deprecated
    associated_ephemera = models.TextField(blank=True)
    availability_status = models.CharField(max_length=13, choices=AVAILABILITY_CHOICES, blank=True) # might need to change to multiple choice
    availability_status_notes = models.TextField(blank=True)
    call_number = models.TextField(blank=True)
    catalog_number = models.CharField(max_length=255, unique=True) # this is the only unique field (besides implicity primary key field)
    cataloged_by = models.CharField(max_length=255, blank=True) #to be replaced with an auto created by field/automated
    cataloged_date = models.CharField(max_length=255, blank=True, validators =[validate_date_text])
    cataloged_date_min = models.DateField(null=True, blank=True)
    cataloged_date_max = models.DateField(null=True, blank=True)
    collaborator = models.ManyToManyField(Collaborator, verbose_name="list of collaborators", related_name='item_collaborators', blank=True)
    collecting_notes = models.TextField(blank=True)
    collection_date = models.CharField(max_length=255, blank=True, validators =[validate_date_text])
    collection_date_min = models.DateField(null=True, blank=True)
    collection_date_max = models.DateField(null=True, blank=True)
    collection_name = models.CharField(max_length=255, blank=True) # automate from catalog number
    collector_info = models.TextField(blank=True)
    collector_name = models.CharField(max_length=255, blank=True)
    collectors_number = models.CharField(max_length=255, blank=True)
    condition = models.CharField(max_length=9, choices=CONDITION_CHOICES, blank=True)
    condition_notes = models.TextField(blank=True)
    conservation_recommendation = models.CharField(max_length=255, blank=True)
    conservation_treatments_performed = models.CharField(max_length=255, blank=True)
    copyrighted_notes = models.TextField(blank=True)
    country_or_territory = models.CharField(max_length=255, blank=True)
    county_or_parish = models.CharField(max_length=255, blank=True)
    creation_date = models.CharField(max_length=255, blank=True, validators =[validate_date_text]) # automate across deposit, based on check box for new deposit
    creation_date_min = models.DateField(null=True, blank=True)
    creation_date_max = models.DateField(null=True, blank=True)
    deposit_date = models.CharField(max_length=255, blank=True, validators =[validate_date_text]) # automate across deposit, based on check box for new deposit
    deposit_date_min = models.DateField(null=True, blank=True)
    deposit_date_max = models.DateField(null=True, blank=True)
    depositor_contact_information = models.TextField(blank=True)
    depositor_name = models.CharField(max_length=255, blank=True)
    description_scope_and_content = models.TextField(blank=True)
    digital_file_location = models.CharField(max_length=255, blank=True) # to be deprecated
    english_title = models.TextField(blank=True)
    equipment_used = models.CharField(max_length=255, blank=True)
    filemaker_legacy_pk_id = models.IntegerField(null=True, blank=True)
    general_content = models.CharField(max_length=30, choices=CONTENT_CHOICES, blank=True) # to be partially automated based on filetype of documents
    genre = MultiSelectField(choices=GENRE_CHOICES, blank=True)
    global_region = models.CharField(max_length=255, blank=True) # automate across deposit
    indigenous_title = models.TextField(blank=True)
    ipm_issues = models.CharField(max_length=255, blank=True)
    isbn = models.CharField(max_length=255, blank=True)
    item_access_level = models.CharField(max_length=1, choices=ACCESS_CHOICES, blank=True) # automate across deposit
    language = models.ManyToManyField(Language, through='DialectInstance', through_fields=('item', 'language'), verbose_name="list of languages", related_name='item_languages', blank=True)
    lender_loan_number = models.CharField(max_length=255, blank=True)
    loc_catalog_number = models.CharField(max_length=255, blank=True)
    location_of_original = models.TextField(blank=True)
    migration_file_format = models.CharField(max_length=255, blank=True) # to be deprecated
    migration_location = models.CharField(max_length=255, blank=True) # to be deprecated
    municipality_or_township = models.CharField(max_length=255, blank=True) # automate across deposit
    original_format_medium = models.CharField(max_length=17, choices=FORMAT_CHOICES, blank=True)
    other_information = models.TextField(blank=True)
    other_institutional_number = models.CharField(max_length=255, blank=True)
    permission_to_publish_online = models.BooleanField(null=True, blank=True)
    project_grant = models.CharField(max_length=255, blank=True) # automate across deposit
    public_event = models.CharField(max_length=255, blank=True)
    publisher = models.CharField(max_length=255, blank=True)
    publisher_address = models.CharField(max_length=255, blank=True)
    recorded_on = models.CharField(max_length=255, blank=True) # automate across deposit
    recording_context = models.TextField(blank=True) # automate across deposit
    software_used = models.CharField(max_length=255, blank=True)
    state_or_province = models.CharField(max_length=255, blank=True) # automate across deposit
    temporary_accession_number = models.CharField(max_length=255, blank=True)
    total_number_of_pages_and_physical_description = models.CharField(max_length=255, blank=True)
    type_of_accession = models.CharField(max_length=12, choices=ACCESSION_CHOICES, blank=True) # automate across deposit
    # educational_materials_text = models.TextField(blank=True)
    # music = MultiSelectField(choices=MUSIC_CHOICES, blank=True)
    # music_text = models.TextField(blank=True)
    language_description_type = MultiSelectField(choices=LANGUAGE_DESCRIPTION_CHOICES, blank=True)
    # descriptive_materials_text = models.TextField(blank=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    class Meta:
        ordering = ['catalog_number']
    def __str__(self):
        return self.catalog_number
    def clean(self):
        self.accession_date = validate_date_text(self.accession_date)
        self.cataloged_date = validate_date_text(self.cataloged_date)
        self.collection_date = validate_date_text(self.collection_date)
        self.creation_date = validate_date_text(self.creation_date)
        self.deposit_date = validate_date_text(self.deposit_date)

class Document(models.Model):
    filename = models.CharField(max_length=255)
    filetype = models.CharField(max_length=32, blank=True)
    access_level = models.CharField(max_length=1, choices=ACCESS_CHOICES, blank=True)
    enumerator = models.PositiveIntegerField(null=True, blank=True)
    title = models.CharField(max_length=255, blank=True)
    duration = models.FloatField(null=True, blank=True)
    filesize = models.FloatField(null=True, blank=True) # to be automated
    av_spec = models.CharField(max_length=255, blank=True) # some automation in the future
    creation_date = models.CharField(max_length=255, blank=True, validators =[validate_date_text])
    creation_date_min = models.DateField(null=True, blank=True)
    creation_date_max = models.DateField(null=True, blank=True)
    language = models.ManyToManyField(Language, through='DialectInstance', through_fields=('document', 'language'), verbose_name="list of languages", related_name='document_languages', blank=True)
    collaborator = models.ManyToManyField(Collaborator, verbose_name="list of collaborators", related_name='document_collaborators', blank=True)
    item = models.ForeignKey('Item', related_name='item_documents', on_delete=models.CASCADE, null=True, blank=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    class Meta:
        ordering = ['filename']
    def __str__(self):
        return self.filename
    def clean(self):
        self.creation_date = validate_date_text(self.creation_date)

class CollaboratorRole(models.Model):
    document = models.ForeignKey('Document', related_name='document_collaboratorroles', on_delete=models.CASCADE, null=True, blank=True)
    item = models.ForeignKey('Item', related_name='item_collaboratorroles', on_delete=models.CASCADE, null=True, blank=True)
    collaborator = models.ForeignKey('Collaborator', related_name='collaborator_collaboratorroles', on_delete=models.CASCADE)
    role = MultiSelectField(choices=ROLE_CHOICES, blank=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    def __str__(self):
        return '{self.pk}'.format(self=self)


class Video(models.Model):
   width = models.PositiveIntegerField(editable=False, null=True)
   height = models.PositiveIntegerField(editable=False, null=True)
   duration = models.FloatField(editable=False, null=True)

   file = VideoField(width_field='width', height_field='height',
                     duration_field='duration')

   format_set = GenericRelation(Format)

@receiver(post_delete, sender=Video)
def submission_delete(sender, instance, **kwargs):
    instance.file.delete(False)

class Columns_export(models.Model):
    name = models.CharField(max_length=255, unique=True)
    item_access_level_restrictions = models.BooleanField(default=True)
    item_accession_date = models.BooleanField(default=True)
    item_accession_number = models.BooleanField(default=True)
    item_acquisition_notes = models.BooleanField(default=True)
    item_additional_digital_file_location = models.BooleanField(default=True)
    item_associated_ephemera = models.BooleanField(default=True)
    item_availability_status = models.BooleanField(default=True)
    item_availability_status_notes = models.BooleanField(default=True)
    item_call_number = models.BooleanField(default=True)
    item_catalog_number = models.BooleanField(default=True)
    item_cataloged_by = models.BooleanField(default=True)
    item_cataloged_date = models.BooleanField(default=True)
    item_collaborator = models.BooleanField(default=True)
    item_collaborator_role = models.BooleanField(default=True)
    item_collecting_notes = models.BooleanField(default=True)
    item_collection_date = models.BooleanField(default=True)
    item_collection_name = models.BooleanField(default=True)
    item_collector_info = models.BooleanField(default=True)
    item_collector_name = models.BooleanField(default=True)
    item_collectors_number = models.BooleanField(default=True)
    item_condition = models.BooleanField(default=True)
    item_condition_notes = models.BooleanField(default=True)
    item_conservation_recommendation = models.BooleanField(default=True)
    item_conservation_treatments_performed = models.BooleanField(default=True)
    item_copyrighted_notes = models.BooleanField(default=True)
    item_country_or_territory = models.BooleanField(default=True)
    item_county_or_parish = models.BooleanField(default=True)
    item_creation_date = models.BooleanField(default=True)
    item_deposit_date = models.BooleanField(default=True)
    item_depositor_contact_information = models.BooleanField(default=True)
    item_depositor_name = models.BooleanField(default=True)
    item_description_scope_and_content = models.BooleanField(default=True)
    item_dialect = models.BooleanField(default=True)
    item_digital_file_location = models.BooleanField(default=True)
    item_document_filename = models.BooleanField(default=True)
    item_document_filetype = models.BooleanField(default=True)
    item_document_access_level = models.BooleanField(default=True)
    item_document_enumerator = models.BooleanField(default=True)
    item_document_title = models.BooleanField(default=True)
    item_document_duration = models.BooleanField(default=True)
    item_document_filesize = models.BooleanField(default=True)
    item_document_av_spec = models.BooleanField(default=True)
    item_document_creation_date = models.BooleanField(default=True)
    item_document_language = models.BooleanField(default=True)
    item_document_dialect = models.BooleanField(default=True)
    item_document_collaborator = models.BooleanField(default=True)
    item_document_collaborator_role = models.BooleanField(default=True)
    item_document_geographic_lat_long = models.BooleanField(default=True)
    item_document_parent_item = models.BooleanField(default=True)
    item_english_title = models.BooleanField(default=True)
    item_equipment_used = models.BooleanField(default=True)
    item_filemaker_legacy_pk_id = models.BooleanField(default=True)
    item_general_content = models.BooleanField(default=True)
    item_genre = models.BooleanField(default=True)
    item_geographic_lat_long = models.BooleanField(default=True)
    item_global_region = models.BooleanField(default=True)
    item_indigenous_title = models.BooleanField(default=True)
    item_ipm_issues = models.BooleanField(default=True)
    item_isbn = models.BooleanField(default=True)
    item_item_access_level = models.BooleanField(default=True)
    item_language = models.BooleanField(default=True)
    item_lender_loan_number = models.BooleanField(default=True)
    item_loc_catalog_number = models.BooleanField(default=True)
    item_location_of_original = models.BooleanField(default=True)
    item_migration_file_format = models.BooleanField(default=True)
    item_migration_location = models.BooleanField(default=True)
    item_municipality_or_township = models.BooleanField(default=True)
    item_original_format_medium = models.BooleanField(default=True)
    item_other_information = models.BooleanField(default=True)
    item_other_institutional_number = models.BooleanField(default=True)
    item_permission_to_publish_online = models.BooleanField(default=True)
    item_project_grant = models.BooleanField(default=True)
    item_public_event = models.BooleanField(default=True)
    item_publisher = models.BooleanField(default=True)
    item_publisher_address = models.BooleanField(default=True)
    item_recorded_on = models.BooleanField(default=True)
    item_recording_context = models.BooleanField(default=True)
    item_software_used = models.BooleanField(default=True)
    item_state_or_province = models.BooleanField(default=True)
    item_temporary_accession_number = models.BooleanField(default=True)
    item_total_number_of_pages_and_physical_description = models.BooleanField(default=True)
    item_type_of_accession = models.BooleanField(default=True)
    # item_educational_materials = models.BooleanField(default=True)
    # item_music = models.BooleanField(default=True)
    item_language_description_type = models.BooleanField(default=True)
    item_added = models.BooleanField(default=True)
    item_updated = models.BooleanField(default=True)
    item_modified_by = models.BooleanField(default=True)
    added = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=255)
    class Meta:
        ordering = ['name']
    def __str__(self):
        return self.name
