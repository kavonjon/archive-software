from django.test import TestCase

from metadata.models import Collection, Collaborator, CollaboratorRole, Item
from metadata.services.collection_item_collaborators import (
    compute_item_collaborators_for_collection,
)


class CollectionItemCollaboratorsTests(TestCase):
    def setUp(self):
        self.collection = Collection.objects.create(
            collection_abbr='COL',
            name='Test Collection',
            modified_by='tester',
        )
        self.other_collection = Collection.objects.create(
            collection_abbr='OTH',
            name='Other Collection',
            modified_by='tester',
        )
        self.author = Collaborator.objects.create(
            collaborator_id=8001,
            first_names='Ada',
            last_names='Author',
            full_name='Ada Author',
            modified_by='tester',
        )
        self.performer = Collaborator.objects.create(
            collaborator_id=8002,
            first_names='Pat',
            last_names='Performer',
            full_name='Pat Performer',
            modified_by='tester',
        )
        self.item = Item.objects.create(
            catalog_number='COL-00001',
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

    def test_includes_all_collaborators_on_fk_linked_items(self):
        results = compute_item_collaborators_for_collection(self.collection)
        self.assertEqual(
            [entry['collaborator'].pk for entry in results],
            [self.author.pk, self.performer.pk],
        )

    def test_includes_non_citation_collaborators(self):
        results = compute_item_collaborators_for_collection(self.collection)
        performer_entry = next(
            entry for entry in results if entry['collaborator'].pk == self.performer.pk
        )
        self.assertEqual(performer_entry['roles'], ['consultant'])
        self.assertEqual(performer_entry['role_display'], ['Consultant'])

    def test_unions_roles_across_items(self):
        second_item = Item.objects.create(
            catalog_number='COL-00002',
            collection=self.collection,
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=second_item,
            collaborator=self.author,
            role=['editor'],
            citation_author=False,
            modified_by='tester',
        )

        results = compute_item_collaborators_for_collection(self.collection)
        author_entry = next(
            entry for entry in results if entry['collaborator'].pk == self.author.pk
        )
        self.assertEqual(author_entry['roles'], ['author', 'editor'])
        self.assertEqual(author_entry['role_display'], ['Author', 'Editor'])

    def test_excludes_other_collections(self):
        other_only = Collaborator.objects.create(
            collaborator_id=8099,
            first_names='Only',
            last_names='Other',
            full_name='Only Other',
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=self.other_item,
            collaborator=other_only,
            role=['author'],
            modified_by='tester',
        )

        results = compute_item_collaborators_for_collection(self.collection)
        collaborator_pks = {entry['collaborator'].pk for entry in results}
        self.assertNotIn(other_only.pk, collaborator_pks)
        self.assertEqual(len(results), 2)

    def test_sort_by_last_name(self):
        zed = Collaborator.objects.create(
            collaborator_id=8003,
            first_names='Zed',
            last_names='Zulu',
            full_name='Zed Zulu',
            modified_by='tester',
        )
        amy = Collaborator.objects.create(
            collaborator_id=8004,
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
                modified_by='tester',
            )

        results = compute_item_collaborators_for_collection(self.collection)
        self.assertEqual(
            [entry['collaborator'].last_names for entry in results],
            ['Alpha', 'Author', 'Performer', 'Zulu'],
        )

    def test_strips_whitespace_from_list_role_values(self):
        spaced = Collaborator.objects.create(
            collaborator_id=8098,
            first_names='Spacy',
            last_names='Roles',
            full_name='Spacy Roles',
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=self.item,
            collaborator=spaced,
            role=['speaker', ' interlocutor'],
            modified_by='tester',
        )

        results = compute_item_collaborators_for_collection(self.collection)
        spaced_entry = next(
            entry for entry in results if entry['collaborator'].pk == spaced.pk
        )
        self.assertEqual(spaced_entry['roles'], ['interlocutor', 'speaker'])
        self.assertEqual(spaced_entry['role_display'], ['Interlocutor', 'Speaker'])

    def test_excludes_items_without_collection_fk(self):
        orphan_item = Item.objects.create(
            catalog_number='ORP-00001',
            modified_by='tester',
        )
        orphan = Collaborator.objects.create(
            collaborator_id=8005,
            first_names='Or',
            last_names='Phan',
            full_name='Or Phan',
            modified_by='tester',
        )
        CollaboratorRole.objects.create(
            item=orphan_item,
            collaborator=orphan,
            role=['author'],
            modified_by='tester',
        )

        results = compute_item_collaborators_for_collection(self.collection)
        self.assertEqual(
            [entry['collaborator'].pk for entry in results],
            [self.author.pk, self.performer.pk],
        )
