import { Item } from '../services/api';
import { normalizeCatalogNumber } from '../services/catalogUniqueness';

/**
 * Sort item IDs by catalog_number (case-insensitive), matching internal API list/cache order.
 */
export function sortItemIdsByCatalogNumber(ids: number[], items: Item[]): number[] {
  if (ids.length <= 1) {
    return ids;
  }

  const catalogById = new Map(items.map((item) => [item.id, normalizeCatalogNumber(item.catalog_number)]));

  return [...ids].sort((a, b) => {
    const catalogA = catalogById.get(a) ?? '';
    const catalogB = catalogById.get(b) ?? '';
    const compare = catalogA.localeCompare(catalogB, undefined, { sensitivity: 'base' });
    if (compare !== 0) {
      return compare;
    }
    return a - b;
  });
}
