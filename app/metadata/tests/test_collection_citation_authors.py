from django.test import TestCase

from metadata.models import Collection, Collaborator, CollaboratorRole, Item
from metadata.services.collection_citation_authors import (
    apply_citation_authors_to_collection,
    compute_citation_authors_for_collection,
)


class CollectionCitationAuthorsTests(TestCase):
    def setUp(self):
        self.collection = Collection.objects.create(
            collection_abbr='CIT',
            name='Citation Collection',
            modified_by='tester',
        )
        self.other_collection = Collection.objects.create(
            collection_abbr='OTH',
            name='Other Collection',
            modified_by='tester',
        )
        self.author = Collaborator.objects.create(
            collaborator_id=9001,
            first_names='Ada',
            last_names='Author',
            full_name='Ada Author',
            modified_by='tester',
        )
        self.performer = Collaborator.objects.create(
            collaborator_id=9002,
            first_names='Pat',
            last_names='Performer',
            full_name='Pat Performer',
            modified_by='tester',
        )
        self.item = Item.objects.create(
            catalog_number='CIT-00001',
            collection=self.collection,
            modified_by='tester',
        )
        self.other_item = Item.objects.create(
            catalog_number='OTH-00001',
            collection=self.other_collection,
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=self.item,
            collaborator=self.author,
            role=['author'],
            citation_author=True,
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=self.item,
            collaborator=self.performer,
            role=['consultant'],
            citation_author=False,
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=self.other_item,
            collaborator=self.author,
            role=['author'],
            citation_author=True,
            modified_by='tester',
        )

    def test_compute_includes_only_citation_authors_in_collection(self):
        results = list(compute_citation_authors_for_collection(self.collection))
        self.assertEqual([c.pk for c in results], [self.author.pk])

    def test_compute_deduplicates_across_items(self):
        second_item = Item.objects.create(
            catalog_number='CIT-00002',
            collection=self.collection,
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=second_item,
            collaborator=self.author,
            role=['author'],
            citation_author=True,
            modified_by='tester',
        )
        results = list(compute_citation_authors_for_collection(self.collection))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].pk, self.author.pk)

    def test_apply_replaces_collection_m2m(self):
        self.collection.citation_authors.add(self.performer)
        count = apply_citation_authors_to_collection(self.collection)
        self.assertEqual(count, 1)
        self.assertEqual(
            list(self.collection.citation_authors.values_list('pk', flat=True)),
            [self.author.pk],
        )

    def test_sort_by_last_name(self):
        zed = Collaborator.objects.create(
            collaborator_id=9003,
            first_names='Zed',
            last_names='Zulu',
            full_name='Zed Zulu',
            modified_by='tester',
        )
        amy = Collaborator.objects.create(
            collaborator_id=9004,
            first_names='Amy',
            last_names='Alpha',
            full_name='Amy Alpha',
            modified_by='tester',
        )
        for collaborator in (zed, amy):
            CollaboratorRole.objects.create(
                item=self.item,
                collaborator=collaborator,
                role=['author'],
                citation_author=True,
                modified_by='tester',
            )

        results = list(compute_citation_authors_for_collection(self.collection))
        self.assertEqual([c.last_names for c in results], ['Alpha', 'Author', 'Zulu'])
