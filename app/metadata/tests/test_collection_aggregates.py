from datetime import date
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase

from metadata.models import Collection, Item, Languoid
from metadata.services.collection_aggregate_scheduling import (
    FLUSH_LOCK_KEY,
    PENDING_KEY,
    QUIET_UNTIL_KEY,
    schedule_collection_aggregate_updates,
)
from metadata.services.collection_aggregates import (
    refresh_collections,
    update_collection_aggregates_for,
)
from metadata.tasks import flush_collection_aggregate_updates


class CollectionAggregatesTests(TestCase):
    def setUp(self):
        self.collection = Collection.objects.create(
            collection_abbr='TST',
            name='Test Collection',
            modified_by='tester',
            access_levels=['1'],
            genres=['audio'],
            item_count=5,
            date_range='1990-2000',
            date_range_min=date(1990, 1, 1),
            date_range_max=date(2000, 12, 31),
        )
        self.language = Languoid.objects.create(
            name='Test Language',
            level_glottolog='language',
            modified_by='tester',
        )

    def test_empty_collection_clears_aggregates(self):
        changed = update_collection_aggregates_for(self.collection)

        self.assertTrue(changed)
        self.collection.refresh_from_db()
        self.assertEqual(self.collection.item_count, 0)
        self.assertEqual(self.collection.access_levels, [])
        self.assertEqual(self.collection.genres, [])
        self.assertEqual(self.collection.date_range, '')
        self.assertIsNone(self.collection.date_range_min)
        self.assertIsNone(self.collection.date_range_max)
        self.assertEqual(list(self.collection.languages.all()), [])

    def test_aggregates_computed_from_linked_items(self):
        item = Item.objects.create(
            catalog_number='TST-00001',
            collection=self.collection,
            modified_by='tester',
            item_access_level='2',
            genre=['audio', 'music'],
            collection_date='2001/03/04-2005/06/07',
        )
        item.language.add(self.language)

        changed = update_collection_aggregates_for(self.collection)

        self.assertTrue(changed)
        self.collection.refresh_from_db()
        self.assertEqual(self.collection.item_count, 1)
        self.assertEqual(self.collection.access_levels, ['2'])
        self.assertEqual(self.collection.genres, ['audio', 'music'])
        self.assertEqual(self.collection.date_range_min, date(2001, 3, 4))
        self.assertEqual(self.collection.date_range_max, date(2005, 6, 7))
        self.assertEqual(
            list(self.collection.languages.values_list('pk', flat=True)),
            [self.language.pk],
        )

    def test_refresh_collections_targets_subset(self):
        other = Collection.objects.create(
            collection_abbr='OTH',
            name='Other Collection',
            modified_by='tester',
            item_count=3,
        )
        Item.objects.create(
            catalog_number='TST-00002',
            collection=self.collection,
            modified_by='tester',
            item_access_level='1',
        )

        updated = refresh_collections([self.collection.pk])

        self.assertEqual(updated, 1)
        self.collection.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(self.collection.item_count, 1)
        self.assertEqual(other.item_count, 3)

    @patch('metadata.tasks.flush_collection_aggregate_updates.apply_async')
    def test_schedule_coalesces_collection_ids(self, mock_apply_async):
        cache.clear()
        schedule_collection_aggregate_updates([self.collection.pk, 99])
        schedule_collection_aggregate_updates([self.collection.pk, 100])

        pending = set(cache.get(PENDING_KEY) or [])
        self.assertEqual(pending, {self.collection.pk, 99, 100})
        self.assertTrue(cache.get(QUIET_UNTIL_KEY))
        self.assertTrue(cache.get(FLUSH_LOCK_KEY))
        mock_apply_async.assert_called_once()

        import time

        cache.set(QUIET_UNTIL_KEY, time.time() - 1, timeout=3600)
        updated = flush_collection_aggregate_updates()
        self.assertEqual(updated, 1)
        self.assertIsNone(cache.get(PENDING_KEY))
