from metadata.models import Collaborator, CollaboratorRole, Collection, ROLE_CHOICES
from metadata.services.collection_citation_authors import order_collaborators_by_last_name

_ROLE_LABEL_BY_KEY = dict(ROLE_CHOICES)
_ROLE_LABEL_BY_LOWER_KEY = {key.lower(): label for key, label in ROLE_CHOICES}


def _role_values(role_field):
    """Parse MultiSelectField role values for collection chip display only."""
    if not role_field:
        return []
    if isinstance(role_field, list):
        return [part.strip() for part in role_field if part and part.strip()]
    return [part.strip() for part in role_field.split(',') if part.strip()]


def _role_display_label(role_value):
    """Map a stored role token to a display label; fallback to the stored value."""
    stripped = role_value.strip()
    if not stripped:
        return stripped
    if stripped in _ROLE_LABEL_BY_KEY:
        return _ROLE_LABEL_BY_KEY[stripped]
    return _ROLE_LABEL_BY_LOWER_KEY.get(stripped.lower(), stripped)


def compute_item_collaborators_for_collection(collection: Collection):
    """
    Distinct collaborators on FK-linked items in this collection, with roles unioned
    across all CollaboratorRole rows. Sorted by last name; anonymous collaborators last.
    """
    if collection.pk is None:
        return []

    roles_qs = CollaboratorRole.objects.filter(
        item__collection=collection,
    ).select_related('collaborator')

    grouped = {}
    for role_row in roles_qs:
        collaborator = role_row.collaborator
        if collaborator.pk not in grouped:
            grouped[collaborator.pk] = {
                'collaborator': collaborator,
                'roles': set(),
            }
        grouped[collaborator.pk]['roles'].update(_role_values(role_row.role))

    if not grouped:
        return []

    entries_by_pk = {}
    for collaborator_pk, data in grouped.items():
        roles = sorted(data['roles'])
        entries_by_pk[collaborator_pk] = {
            'collaborator': data['collaborator'],
            'roles': roles,
            'role_display': sorted({_role_display_label(role_value) for role_value in roles}),
        }

    ordered_pks = order_collaborators_by_last_name(
        Collaborator.objects.filter(pk__in=grouped.keys())
    ).values_list('pk', flat=True)

    return [entries_by_pk[pk] for pk in ordered_pks]
