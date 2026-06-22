import { Collection } from '../services/api';

function escapeCsvField(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function collectionsToCsv(collections: Collection[]): string {
  const headers = [
    'Abbreviation',
    'Name',
    'Extent',
    'Date Range',
    'Item Count',
    'Citation Authors',
    'Abstract',
  ];

  const rows = collections.map((collection) =>
    [
      collection.collection_abbr,
      collection.name,
      collection.extent,
      collection.date_range,
      collection.item_count ?? 0,
      collection.citation_author_names?.join('; ')
        ?? collection.citation_authors?.map((author) => author.display_name || author.full_name).join('; ')
        ?? '',
      collection.abstract,
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCollectionsCsv(collections: Collection[], filenamePrefix = 'collections-export'): void {
  const csv = collectionsToCsv(collections);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
