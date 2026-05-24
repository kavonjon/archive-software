import React from 'react';
import { Item } from '../../services/api';
import {
  AccessLevelCell,
  CatalogCell,
  ChipListCell,
  CollaboratorsCell,
  LanguagesCell,
  PlainTextCell,
  ResourceTypeCell,
  TitlesCell,
  formatTimestamp,
} from './itemListColumnHelpers';

export type ItemListColumnId =
  | 'catalog'
  | 'call_number'
  | 'accession_number'
  | 'accession_date'
  | 'title'
  | 'description'
  | 'genre'
  | 'language_description_type'
  | 'browse_categories'
  | 'creation_date'
  | 'associated_ephemera'
  | 'access_restrictions'
  | 'copyright_notes'
  | 'type'
  | 'languages'
  | 'collaborators'
  | 'access'
  | 'availability_status'
  | 'availability_notes'
  | 'condition'
  | 'condition_notes'
  | 'ipm_issues'
  | 'conservation_treatments'
  | 'conservation_recommendation'
  | 'collection'
  | 'type_of_accession'
  | 'acquisition_notes'
  | 'project_grant'
  | 'collector_name'
  | 'collector_info'
  | 'collectors_number'
  | 'collection_date'
  | 'collecting_notes'
  | 'depositor_name'
  | 'depositor_contact'
  | 'deposit_date'
  | 'municipality'
  | 'county'
  | 'state'
  | 'country'
  | 'global_region'
  | 'latitude'
  | 'longitude'
  | 'recording_context'
  | 'public_event'
  | 'original_format_medium'
  | 'recorded_on'
  | 'equipment_used'
  | 'software_used'
  | 'location_of_original'
  | 'other_information'
  | 'publisher'
  | 'publisher_address'
  | 'isbn'
  | 'loc_catalog_number'
  | 'pages_physical_description'
  | 'temporary_accession_number'
  | 'lender_loan_number'
  | 'other_institutional_number'
  | 'updated'
  | 'modified_by';

export interface ItemListColumnDef {
  id: ItemListColumnId;
  label: string;
  group: string;
  defaultVisible: boolean;
  hideable: boolean;
  renderCell: (item: Item, rowIndex: number) => React.ReactNode;
}

export const ITEM_LIST_COLUMN_GROUPS = [
  'Titles',
  'Collection Information',
  'Item Details',
  'Description',
  'Languages and Dialects',
  'Collaborators',
  'Important Dates',
  'Tags',
  'Browse Categories',
  'Access & Permissions',
  'Accessions',
  'Condition',
  'Location',
  'Coordinates',
  'Digitization',
  'Books',
  'External',
  'Metadata History',
] as const;

/** Field order within each detail-page card (matches ItemDetail.tsx). */
export const ITEM_LIST_DETAIL_FIELD_ORDER: ItemListColumnId[] = [
  'title',
  'description',
  'language_description_type',
  'associated_ephemera',
  'languages',
  'collaborators',
  'access_restrictions',
  'copyright_notes',
  'accession_number',
  'accession_date',
  'type_of_accession',
  'acquisition_notes',
  'project_grant',
  'collector_name',
  'collector_info',
  'collectors_number',
  'collection_date',
  'collecting_notes',
  'depositor_name',
  'depositor_contact',
  'deposit_date',
  'original_format_medium',
  'recorded_on',
  'equipment_used',
  'software_used',
  'conservation_recommendation',
  'location_of_original',
  'other_information',
  'publisher',
  'publisher_address',
  'isbn',
  'loc_catalog_number',
  'pages_physical_description',
  'collection',
  'access',
  'type',
  'call_number',
  'creation_date',
  'genre',
  'browse_categories',
  'availability_status',
  'availability_notes',
  'condition',
  'condition_notes',
  'ipm_issues',
  'conservation_treatments',
  'municipality',
  'county',
  'state',
  'country',
  'global_region',
  'recording_context',
  'public_event',
  'latitude',
  'longitude',
  'temporary_accession_number',
  'lender_loan_number',
  'other_institutional_number',
  'updated',
  'modified_by',
];

type TextColumnOptions = {
  defaultVisible?: boolean;
  truncate?: boolean;
};

function textColumn(
  id: ItemListColumnId,
  label: string,
  group: string,
  getValue: (item: Item) => string | number | null | undefined,
  options: TextColumnOptions = {}
): ItemListColumnDef {
  return {
    id,
    label,
    group,
    defaultVisible: options.defaultVisible ?? false,
    hideable: true,
    renderCell: (item, rowIndex) => (
      <PlainTextCell
        columnId={id}
        rowIndex={rowIndex}
        value={getValue(item)}
        truncate={options.truncate}
      />
    ),
  };
}

function chipListColumn(
  id: ItemListColumnId,
  label: string,
  group: string,
  getValues: (item: Item) => string[] | null | undefined,
  options: { defaultVisible?: boolean } = {}
): ItemListColumnDef {
  return {
    id,
    label,
    group,
    defaultVisible: options.defaultVisible ?? false,
    hideable: true,
    renderCell: (item, rowIndex) => (
      <ChipListCell columnId={id} rowIndex={rowIndex} values={getValues(item)} />
    ),
  };
}

export const ITEM_LIST_COLUMNS: ItemListColumnDef[] = [
  {
    id: 'catalog',
    label: 'Catalog #',
    group: 'Item Details',
    defaultVisible: true,
    hideable: false,
    renderCell: (item, rowIndex) => <CatalogCell item={item} rowIndex={rowIndex} />,
  },
  textColumn('call_number', 'Call Number', 'Item Details', (item) => item.call_number, {
    defaultVisible: true,
  }),
  {
    id: 'title',
    label: 'Title(s)',
    group: 'Titles',
    defaultVisible: true,
    hideable: true,
    renderCell: (item, rowIndex) => <TitlesCell item={item} rowIndex={rowIndex} />,
  },
  {
    id: 'type',
    label: 'Resource Type',
    group: 'Item Details',
    defaultVisible: true,
    hideable: true,
    renderCell: (item, rowIndex) => <ResourceTypeCell item={item} rowIndex={rowIndex} />,
  },
  {
    id: 'languages',
    label: 'Languages',
    group: 'Languages and Dialects',
    defaultVisible: true,
    hideable: true,
    renderCell: (item, rowIndex) => <LanguagesCell item={item} rowIndex={rowIndex} />,
  },
  {
    id: 'access',
    label: 'Access Level',
    group: 'Item Details',
    defaultVisible: true,
    hideable: true,
    renderCell: (item, rowIndex) => <AccessLevelCell item={item} rowIndex={rowIndex} />,
  },
  textColumn(
    'description',
    'Description Scope and Content',
    'Description',
    (item) => item.description_scope_and_content,
    { truncate: true }
  ),
  chipListColumn(
    'language_description_type',
    'Language Description Type',
    'Description',
    (item) => item.language_description_type_display
  ),
  textColumn(
    'associated_ephemera',
    'Associated Ephemera',
    'Description',
    (item) => item.associated_ephemera,
    { truncate: true }
  ),
  {
    id: 'collaborators',
    label: 'Collaborators',
    group: 'Collaborators',
    defaultVisible: false,
    hideable: true,
    renderCell: (item, rowIndex) => <CollaboratorsCell item={item} rowIndex={rowIndex} />,
  },
  textColumn(
    'access_restrictions',
    'Access Level Restrictions',
    'Access & Permissions',
    (item) => item.access_level_restrictions,
    { truncate: true }
  ),
  textColumn(
    'copyright_notes',
    'Copyrighted Notes',
    'Access & Permissions',
    (item) => item.copyrighted_notes,
    { truncate: true }
  ),
  textColumn('accession_number', 'Accession Number', 'Accessions', (item) => item.accession_number),
  textColumn('accession_date', 'Accession Date', 'Accessions', (item) => item.accession_date),
  textColumn(
    'type_of_accession',
    'Type of Accession',
    'Accessions',
    (item) => item.type_of_accession_display
  ),
  textColumn(
    'acquisition_notes',
    'Acquisition Notes',
    'Accessions',
    (item) => item.acquisition_notes,
    { truncate: true }
  ),
  textColumn('project_grant', 'Project/Grant', 'Accessions', (item) => item.project_grant),
  textColumn('collector_name', 'Collector Name', 'Accessions', (item) => item.collector_name),
  textColumn(
    'collector_info',
    'Collector Info',
    'Accessions',
    (item) => item.collector_info,
    { truncate: true }
  ),
  textColumn(
    'collectors_number',
    "Collector's Number",
    'Accessions',
    (item) => item.collectors_number
  ),
  textColumn('collection_date', 'Collection Date', 'Accessions', (item) => item.collection_date),
  textColumn(
    'collecting_notes',
    'Collecting Notes',
    'Accessions',
    (item) => item.collecting_notes,
    { truncate: true }
  ),
  textColumn('depositor_name', 'Depositor Name', 'Accessions', (item) => item.depositor_name),
  textColumn(
    'depositor_contact',
    'Depositor Contact Information',
    'Accessions',
    (item) => item.depositor_contact_information,
    { truncate: true }
  ),
  textColumn('deposit_date', 'Deposit Date', 'Accessions', (item) => item.deposit_date),
  textColumn(
    'original_format_medium',
    'Original Format Medium',
    'Digitization',
    (item) => item.original_format_medium_display
  ),
  textColumn('recorded_on', 'Recorded On', 'Digitization', (item) => item.recorded_on),
  textColumn('equipment_used', 'Equipment Used', 'Digitization', (item) => item.equipment_used),
  textColumn('software_used', 'Software Used', 'Digitization', (item) => item.software_used),
  textColumn(
    'conservation_recommendation',
    'Conservation Recommendation',
    'Digitization',
    (item) => item.conservation_recommendation,
    { truncate: true }
  ),
  textColumn(
    'location_of_original',
    'Location of Original',
    'Digitization',
    (item) => item.location_of_original,
    { truncate: true }
  ),
  textColumn(
    'other_information',
    'Other Information',
    'Digitization',
    (item) => item.other_information,
    { truncate: true }
  ),
  textColumn('publisher', 'Publisher', 'Books', (item) => item.publisher),
  textColumn(
    'publisher_address',
    'Publisher Address',
    'Books',
    (item) => item.publisher_address,
    { truncate: true }
  ),
  textColumn('isbn', 'ISBN', 'Books', (item) => item.isbn),
  textColumn('loc_catalog_number', 'LOC Catalog Number', 'Books', (item) => item.loc_catalog_number),
  textColumn(
    'pages_physical_description',
    'Total Number of Pages and Physical Description',
    'Books',
    (item) => item.total_number_of_pages_and_physical_description,
    { truncate: true }
  ),
  textColumn('collection', 'Collection', 'Collection Information', (item) => item.collection_abbr),
  textColumn('creation_date', 'Creation Date', 'Important Dates', (item) => item.creation_date),
  chipListColumn('genre', 'Genres', 'Tags', (item) => item.genre_display),
  chipListColumn(
    'browse_categories',
    'Browse Categories',
    'Browse Categories',
    (item) => item.browse_categories_display
  ),
  textColumn(
    'availability_status',
    'Availability Status',
    'Condition',
    (item) => item.availability_status_display
  ),
  textColumn(
    'availability_notes',
    'Availability Status Notes',
    'Condition',
    (item) => item.availability_status_notes,
    { truncate: true }
  ),
  textColumn('condition', 'Condition', 'Condition', (item) => item.condition_display),
  textColumn(
    'condition_notes',
    'Condition Notes',
    'Condition',
    (item) => item.condition_notes,
    { truncate: true }
  ),
  textColumn('ipm_issues', 'IPM Issues', 'Condition', (item) => item.ipm_issues, { truncate: true }),
  textColumn(
    'conservation_treatments',
    'Conservation Treatments Performed',
    'Condition',
    (item) => item.conservation_treatments_performed,
    { truncate: true }
  ),
  textColumn(
    'municipality',
    'Municipality or Township',
    'Location',
    (item) => item.municipality_or_township
  ),
  textColumn('county', 'County or Parish', 'Location', (item) => item.county_or_parish),
  textColumn('state', 'State or Province', 'Location', (item) => item.state_or_province),
  textColumn('country', 'Country or Territory', 'Location', (item) => item.country_or_territory),
  textColumn('global_region', 'Global Region', 'Location', (item) => item.global_region),
  textColumn(
    'recording_context',
    'Recording Context',
    'Location',
    (item) => item.recording_context,
    { truncate: true }
  ),
  textColumn('public_event', 'Public Event', 'Location', (item) => item.public_event),
  textColumn('latitude', 'Latitude', 'Coordinates', (item) => item.latitude),
  textColumn('longitude', 'Longitude', 'Coordinates', (item) => item.longitude),
  textColumn(
    'temporary_accession_number',
    'Temporary Accession Number',
    'External',
    (item) => item.temporary_accession_number
  ),
  textColumn(
    'lender_loan_number',
    'Lender Loan Number',
    'External',
    (item) => item.lender_loan_number
  ),
  textColumn(
    'other_institutional_number',
    'Other Institutional Number',
    'External',
    (item) => item.other_institutional_number
  ),
  {
    id: 'updated',
    label: 'Last Updated',
    group: 'Metadata History',
    defaultVisible: false,
    hideable: true,
    renderCell: (item, rowIndex) => (
      <PlainTextCell
        columnId="updated"
        rowIndex={rowIndex}
        value={formatTimestamp(item.updated)}
      />
    ),
  },
  textColumn('modified_by', 'Modified By', 'Metadata History', (item) => item.modified_by),
];
