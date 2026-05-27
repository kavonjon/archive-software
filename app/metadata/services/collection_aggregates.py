import logging
from django.db.models import Max, Min

from metadata.models import Collection, Item

logger = logging.getLogger(__name__)


def format_date_range(min_date, max_date):
    """Format date range as YYYY/MM/DD with appropriate simplifications."""
    if min_date is None and max_date is None:
        return ""

    if min_date is None and max_date is not None:
        min_date = max_date
    elif max_date is None and min_date is not None:
        max_date = min_date

    try:
        min_str = min_date.strftime("%Y/%m/%d")
        max_str = max_date.strftime("%Y/%m/%d")

        if min_date.year == max_date.year:
            if min_date.month == max_date.month:
                if min_date.day == max_date.day:
                    return f"{min_date.year}/{min_date.month:02d}/{min_date.day:02d}"
                return f"{min_date.year}/{min_date.month:02d}/{min_date.day:02d}-{max_date.day:02d}"
            if (
                min_date.month == 1
                and min_date.day == 1
                and max_date.month == 12
                and max_date.day == 31
            ):
                return f"{min_date.year}"
            return f"{min_date.year}/{min_date.month:02d}-{max_date.month:02d}"

        if (
            min_date.month == 1
            and min_date.day == 1
            and max_date.month == 12
            and max_date.day == 31
        ):
            return f"{min_date.year}-{max_date.year}"
        return f"{min_str}-{max_str}"
    except Exception as exc:
        logger.error("Error formatting date range: %s", exc)
        return ""


def _normalize_multiselect(value):
    if not value:
        return []
    if isinstance(value, str):
        return sorted(part for part in value.split(",") if part)
    return sorted(value)


def compute_date_range(items_qs):
    collection_min_date = items_qs.exclude(collection_date_min=None).aggregate(
        Min("collection_date_min")
    )["collection_date_min__min"]
    accession_min_date = items_qs.exclude(accession_date_min=None).aggregate(
        Min("accession_date_min")
    )["accession_date_min__min"]
    collection_max_date = items_qs.exclude(collection_date_max=None).aggregate(
        Max("collection_date_max")
    )["collection_date_max__max"]
    accession_max_date = items_qs.exclude(accession_date_max=None).aggregate(
        Max("accession_date_max")
    )["accession_date_max__max"]

    min_date = collection_min_date or accession_min_date
    max_date = collection_max_date or accession_max_date
    date_range = format_date_range(min_date, max_date)
    return min_date, max_date, date_range


def compute_access_levels(items_qs):
    levels = set()
    for item in items_qs.only("item_access_level"):
        if item.item_access_level:
            levels.add(item.item_access_level)
    return sorted(levels)


def compute_genres(items_qs):
    genres = set()
    for item in items_qs.only("genre"):
        if item.genre:
            genres.update(item.genre)
    return sorted(genres)


def compute_language_ids(items_qs):
    language_ids = set()
    for item in items_qs.prefetch_related("language"):
        language_ids.update(item.language.values_list("pk", flat=True))
    return language_ids


def update_collection_aggregates_for(collection: Collection) -> bool:
    """Recompute all derived collection fields. Returns True if anything changed."""
    items_qs = Item.objects.filter(collection=collection).prefetch_related("language")
    item_count = items_qs.count()
    changed = False
    update_fields = []

    if item_count == 0:
        if collection.item_count != 0:
            collection.item_count = 0
            update_fields.append("item_count")

        if collection.date_range_min is not None:
            collection.date_range_min = None
            update_fields.append("date_range_min")
        if collection.date_range_max is not None:
            collection.date_range_max = None
            update_fields.append("date_range_max")
        if collection.date_range:
            collection.date_range = ""
            update_fields.append("date_range")

        new_access_levels = []
        new_genres = []
        new_language_ids = set()
    else:
        if collection.item_count != item_count:
            collection.item_count = item_count
            update_fields.append("item_count")

        min_date, max_date, date_range = compute_date_range(items_qs)
        if collection.date_range_min != min_date:
            collection.date_range_min = min_date
            update_fields.append("date_range_min")
        if collection.date_range_max != max_date:
            collection.date_range_max = max_date
            update_fields.append("date_range_max")
        if collection.date_range != date_range:
            collection.date_range = date_range
            update_fields.append("date_range")

        new_access_levels = compute_access_levels(items_qs)
        new_genres = compute_genres(items_qs)
        new_language_ids = compute_language_ids(items_qs)

    if _normalize_multiselect(collection.access_levels) != new_access_levels:
        collection.access_levels = new_access_levels
        update_fields.append("access_levels")

    if _normalize_multiselect(collection.genres) != new_genres:
        collection.genres = new_genres
        update_fields.append("genres")

    if update_fields:
        collection.save(update_fields=update_fields)
        changed = True

    current_language_ids = set(collection.languages.values_list("pk", flat=True))
    if current_language_ids != new_language_ids:
        collection.languages.set(new_language_ids)
        changed = True

    return changed


def refresh_collections(collection_ids=None) -> int:
    """Refresh aggregates for all collections or a subset. Returns count updated."""
    if collection_ids is None:
        collections = Collection.objects.all()
    else:
        unique_ids = sorted({int(collection_id) for collection_id in collection_ids})
        if not unique_ids:
            return 0
        collections = Collection.objects.filter(pk__in=unique_ids)

    update_count = 0
    for collection in collections:
        if update_collection_aggregates_for(collection):
            update_count += 1
    return update_count
