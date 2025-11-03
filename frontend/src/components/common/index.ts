// Reusable EditableField system for inline editing across all CRUD pages
export { EditableField, createAbbreviatedLabel } from './EditableField';
export type { EditableFieldProps } from './EditableField';

export { EditableTextField } from './EditableTextField';
export type { EditableTextFieldProps } from './EditableTextField';

export { EditableSelectField } from './EditableSelectField';
export type { EditableSelectFieldProps, SelectOption } from './EditableSelectField';

export { EditableMultiSelectField } from './EditableMultiSelectField';
export type { EditableMultiSelectFieldProps } from './EditableMultiSelectField';
export { EditableMultiRelationshipField } from './EditableMultiRelationshipField';
export type { EditableMultiRelationshipFieldProps } from './EditableMultiRelationshipField';

export { EditableBooleanField } from './EditableBooleanField';
export type { EditableBooleanFieldProps } from './EditableBooleanField';

export { EditableJsonArrayField } from './EditableJsonArrayField';
export type { EditableJsonArrayFieldProps } from './EditableJsonArrayField';

export { EditableRelationshipField } from './EditableRelationshipField';
export type { EditableRelationshipFieldProps, RelationshipOption } from './EditableRelationshipField';

// Re-export existing common components
export { DateFormatHelp } from './DateFormatHelp';
export { DateInterpretationFeedback } from './DateInterpretationFeedback';
export { InfoIconLink } from './InfoIconLink';
export type { InfoIconLinkProps } from './InfoIconLink';
