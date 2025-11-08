# Generated manually for decommissioning Dialect and DialectInstance models

from django.db import migrations, models


def migrate_dialectinstance_data(apps, schema_editor):
    """
    Migrate data from DialectInstance through model to Django's auto-generated M2M tables.
    
    For each DialectInstance record, we:
    1. Extract the relationship (collaborator_native/collaborator_other/item/document → language)
    2. Add the relationship to the new M2M table (which uses Django's default through model)
    
    The modified_by tracking from DialectInstance is intentionally not preserved
    in the new M2M tables, as Django's default through models don't support custom fields.
    This data is archived in the old DialectInstance table for historical reference.
    """
    # Get models
    DialectInstance = apps.get_model('metadata', 'DialectInstance')
    Collaborator = apps.get_model('metadata', 'Collaborator')
    Item = apps.get_model('metadata', 'Item')
    Document = apps.get_model('metadata', 'Document')
    
    # Track statistics
    stats = {
        'collaborator_native': 0,
        'collaborator_other': 0,
        'item': 0,
        'document': 0,
        'skipped': 0,
    }
    
    # Process each DialectInstance
    for di in DialectInstance.objects.all():
        try:
            # Collaborator native languages
            if di.collaborator_native_id:
                collaborator = Collaborator.objects.get(id=di.collaborator_native_id)
                collaborator.native_languages.add(di.language_id)
                stats['collaborator_native'] += 1
            
            # Collaborator other languages
            elif di.collaborator_other_id:
                collaborator = Collaborator.objects.get(id=di.collaborator_other_id)
                collaborator.other_languages.add(di.language_id)
                stats['collaborator_other'] += 1
            
            # Item languages
            elif di.item_id:
                item = Item.objects.get(id=di.item_id)
                item.language.add(di.language_id)
                stats['item'] += 1
            
            # Document languages
            elif di.document_id:
                document = Document.objects.get(id=di.document_id)
                document.language.add(di.language_id)
                stats['document'] += 1
            
            else:
                # Orphan DialectInstance with no relationship - skip
                stats['skipped'] += 1
                
        except Exception as e:
            print(f"⚠️  Error migrating DialectInstance {di.id}: {e}")
            stats['skipped'] += 1
    
    # Print migration summary
    print(f"\n{'='*80}")
    print(f"✅ DialectInstance Data Migration Complete")
    print(f"{'='*80}")
    print(f"  Collaborator native languages: {stats['collaborator_native']}")
    print(f"  Collaborator other languages:  {stats['collaborator_other']}")
    print(f"  Item languages:                {stats['item']}")
    print(f"  Document languages:            {stats['document']}")
    print(f"  Skipped (orphan/error):        {stats['skipped']}")
    print(f"  Total processed:               {DialectInstance.objects.count()}")
    print(f"{'='*80}\n")


def reverse_migrate_to_dialectinstance(apps, schema_editor):
    """
    Reverse migration: This would require recreating DialectInstance records
    from the new M2M tables, but we intentionally leave this as a no-op.
    
    Rollback is not supported for this migration because:
    1. The old Dialect/DialectInstance models are deprecated
    2. modified_by tracking would be lost (we don't have that data in new M2M tables)
    3. This is a one-way upgrade to a cleaner data model
    
    If rollback is absolutely needed, restore from a database backup.
    """
    print("\n⚠️  WARNING: Reverse migration not supported for dialect decommissioning.")
    print("   If you need to rollback, restore from a database backup.\n")


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0101_convert_other_names_to_array'),
    ]

    operations = [
        # Step 1: Remove old M2M fields (with custom through)
        migrations.RemoveField(
            model_name='collaborator',
            name='native_languages',
        ),
        migrations.RemoveField(
            model_name='collaborator',
            name='other_languages',
        ),
        migrations.RemoveField(
            model_name='item',
            name='language',
        ),
        migrations.RemoveField(
            model_name='document',
            name='language',
        ),
        
        # Step 2: Add new M2M fields (without through, using Django's default)
        migrations.AddField(
            model_name='collaborator',
            name='native_languages',
            field=models.ManyToManyField(
                blank=True,
                related_name='collaborator_native_languages',
                to='metadata.languoid',
                verbose_name='Native/First languages'
            ),
        ),
        migrations.AddField(
            model_name='collaborator',
            name='other_languages',
            field=models.ManyToManyField(
                blank=True,
                related_name='collaborator_other_languages',
                to='metadata.languoid',
                verbose_name='Other languages'
            ),
        ),
        migrations.AddField(
            model_name='item',
            name='language',
            field=models.ManyToManyField(
                blank=True,
                related_name='item_languages',
                to='metadata.languoid',
                verbose_name='list of languages'
            ),
        ),
        migrations.AddField(
            model_name='document',
            name='language',
            field=models.ManyToManyField(
                blank=True,
                related_name='document_languages',
                to='metadata.languoid',
                verbose_name='list of languages'
            ),
        ),
        
        # Step 3: Migrate data from DialectInstance to new M2M tables
        migrations.RunPython(
            migrate_dialectinstance_data,
            reverse_migrate_to_dialectinstance
        ),
        
        # Step 4: Delete old models
        # Note: Django will automatically drop the database tables
        migrations.DeleteModel(
            name='DialectInstance',
        ),
        migrations.DeleteModel(
            name='Dialect',
        ),
    ]

