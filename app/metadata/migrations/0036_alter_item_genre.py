# Generated by Django 3.2 on 2024-05-08 13:54

from django.db import migrations
import multiselectfield.db.fields


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0035_alter_item_general_content'),
    ]

    operations = [
        migrations.AlterField(
            model_name='item',
            name='genre',
            field=multiselectfield.db.fields.MultiSelectField(blank=True, choices=[('49', '49'), ('article', 'Article'), ('book', 'Book'), ('ceremonial', 'Ceremonial'), ('conversation', 'Conversation'), ('correspondence', 'Correspondence'), ('dataset', 'Dataset'), ('document', 'Document'), ('drama', 'Drama'), ('educational', 'Educational material'), ('educational_material_family', 'Educational materials: Family'), ('educational_material_learners', 'Educational materials: For learners'), ('educational_material_teachers', 'Educational materials: For teachers'), ('educational_materials_planning', 'Educational materials: Language planning'), ('elicitation', 'Elicitation'), ('ethnography', 'Ethnography'), ('for_children', 'For children'), ('hand_game', 'Hand game'), ('history', 'History'), ('hymn', 'Hymn'), ('interview', 'Interview'), ('music', 'Music'), ('narrative', 'Narrative'), ('native_american_church', 'Native American Church'), ('oratory', 'Oratory'), ('photograph', 'Photograph'), ('poetry', 'Poetry'), ('popular_production', 'Popular production'), ('powwow', 'Powwow'), ('prayer', 'Prayer'), ('procedural', 'Procedural'), ('round_dance', 'Round dance'), ('saying_proverb', 'Saying or Proverb'), ('speech', 'Speech play'), ('stomp_dance', 'Stomp dance'), ('sundance', 'Sundance'), ('textbook', 'Textbook'), ('thesis', 'Thesis'), ('traditional_story', 'Traditional story'), ('transcript', 'Transcript'), ('translation', 'Translation'), ('unintelligible', 'Unintelligible speech'), ('war_dance', 'War dance')], max_length=524),
        ),
    ]