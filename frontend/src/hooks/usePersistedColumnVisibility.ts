import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ColumnVisibilityConfig<T extends string> {
  id: T;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
}

interface StoredColumnVisibility<T extends string> {
  version: number;
  visible: T[];
}

function buildDefaultVisibleSet<T extends string>(
  columns: ColumnVisibilityConfig<T>[]
): Set<T> {
  return new Set(
    columns
      .filter((column) => !column.hideable || column.defaultVisible)
      .map((column) => column.id)
  );
}

function loadVisibleColumns<T extends string>(
  storageKey: string,
  version: number,
  columns: ColumnVisibilityConfig<T>[]
): Set<T> {
  const defaults = buildDefaultVisibleSet(columns);
  const validIds = new Set(columns.map((column) => column.id));

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return defaults;
    }

    const parsed = JSON.parse(stored) as StoredColumnVisibility<T>;
    if (parsed.version !== version || !Array.isArray(parsed.visible)) {
      return defaults;
    }

    const storedVisible = parsed.visible.filter((columnId) => validIds.has(columnId));
    const hasExistingPrefs = storedVisible.length > 0;
    const visible = new Set<T>();

    columns.forEach((column) => {
      if (!column.hideable) {
        visible.add(column.id);
        return;
      }

      if (hasExistingPrefs) {
        if (storedVisible.includes(column.id)) {
          visible.add(column.id);
        }
        return;
      }

      if (column.defaultVisible) {
        visible.add(column.id);
      }
    });

    return visible.size > 0 ? visible : defaults;
  } catch (error) {
    console.warn(`Failed to load column visibility for ${storageKey}:`, error);
    return defaults;
  }
}

function persistVisibleColumns<T extends string>(
  storageKey: string,
  version: number,
  visibleColumnIds: Set<T>
) {
  const payload: StoredColumnVisibility<T> = {
    version,
    visible: Array.from(visibleColumnIds),
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function usePersistedColumnVisibility<T extends string>(options: {
  storageKey: string;
  version: number;
  columns: ColumnVisibilityConfig<T>[];
}) {
  const { storageKey, version, columns } = options;

  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<T>>(() =>
    loadVisibleColumns(storageKey, version, columns)
  );

  useEffect(() => {
    persistVisibleColumns(storageKey, version, visibleColumnIds);
  }, [storageKey, version, visibleColumnIds]);

  const isVisible = useCallback(
    (columnId: T) => visibleColumnIds.has(columnId),
    [visibleColumnIds]
  );

  const toggleColumn = useCallback(
    (columnId: T) => {
      const column = columns.find((entry) => entry.id === columnId);
      if (!column?.hideable) {
        return;
      }

      setVisibleColumnIds((current) => {
        const next = new Set(current);
        if (next.has(columnId)) {
          next.delete(columnId);
        } else {
          next.add(columnId);
        }
        return next;
      });
    },
    [columns]
  );

  const resetToDefaults = useCallback(() => {
    setVisibleColumnIds(buildDefaultVisibleSet(columns));
  }, [columns]);

  const hideableColumns = useMemo(
    () => columns.filter((column) => column.hideable),
    [columns]
  );

  return {
    visibleColumnIds,
    hideableColumns,
    isVisible,
    toggleColumn,
    resetToDefaults,
  };
}
