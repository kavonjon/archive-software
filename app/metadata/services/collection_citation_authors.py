from django.db.models import Case, IntegerField, Value, When
from django.db.models.functions import Coalesce, Lower

from metadata.models import Collaborator, Collection


def order_collaborators_by_last_name(queryset):
    """Sort collaborators by last name; anonymous entries last."""
    return queryset.annotate(
        _anonymous_sort=Case(
            When(anonymous=True, then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        ),
        _last_name_sort=Lower(Coalesce('last_names', Value(''))),
        _first_name_sort=Lower(Coalesce('first_names', Value(''))),
    ).order_by('_anonymous_sort', '_last_name_sort', '_first_name_sort', 'collaborator_id')


def compute_citation_authors_for_collection(collection: Collection):
    """
    Distinct collaborators marked citation_author on any FK-linked item in this collection.
    Sorted by last name; anonymous collaborators sort last.
    """
    if collection.pk is None:
        return Collaborator.objects.none()

    return order_collaborators_by_last_name(
        Collaborator.objects.filter(
            collaborator_collaboratorroles__item__collection=collection,
            collaborator_collaboratorroles__citation_author=True,
        ).distinct()
    )


def apply_citation_authors_to_collection(collection: Collection) -> int:
    """Replace collection citation_authors M2M with computed set. Returns count set."""
    collaborators = list(compute_citation_authors_for_collection(collection))
    collection.citation_authors.set(collaborators)
    return len(collaborators)
