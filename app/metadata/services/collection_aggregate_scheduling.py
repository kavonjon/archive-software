import logging
import time
from typing import Iterable

from django.core.cache import cache

logger = logging.getLogger(__name__)

QUIET_SECONDS = 5
PENDING_KEY = "collection_aggregate:pending_ids"
QUIET_UNTIL_KEY = "collection_aggregate:quiet_until"
FLUSH_LOCK_KEY = "collection_aggregate:flush_lock"

MAINTENANCE_QUEUE = "maintenance"
AGGREGATE_TASK_PRIORITY = 1


def schedule_collection_aggregate_updates(collection_ids: Iterable[int]) -> None:
    """Coalesce collection aggregate updates; flush one task after a quiet period."""
    ids = {int(collection_id) for collection_id in collection_ids if collection_id}
    if not ids:
        return

    existing = set(cache.get(PENDING_KEY) or [])
    existing.update(ids)
    cache.set(PENDING_KEY, list(existing), timeout=3600)
    cache.set(QUIET_UNTIL_KEY, time.time() + QUIET_SECONDS, timeout=3600)

    if cache.add(FLUSH_LOCK_KEY, 1, timeout=QUIET_SECONDS + 30):
        from metadata.tasks import flush_collection_aggregate_updates

        flush_collection_aggregate_updates.apply_async(
            countdown=QUIET_SECONDS,
            priority=AGGREGATE_TASK_PRIORITY,
            queue=MAINTENANCE_QUEUE,
        )
        logger.info(
            "Scheduled collection aggregate flush in %ss for collections %s",
            QUIET_SECONDS,
            sorted(ids),
        )
