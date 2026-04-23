# Accessibility (ADA Compliance)

**Critical**: All UI changes must consider accessibility. This is non-negotiable.

## Core Requirements

### WCAG 2.1 Level AA Compliance

**Must meet**:
- Semantic HTML (headings, landmarks, lists)
- ARIA labels and descriptions
- Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Screen reader compatibility
- 44px minimum touch targets (mobile/tablet)
- 4.5:1 color contrast ratio (text)
- Visible focus indicators
- Logical tab order

**Legal Requirement**: ADA Title III compliance required for public-facing interfaces

**Standards**: WCAG 2.1 AA, Section 508, ADA Title III

### Responsive Design

**Approach**: Mobile-first design with responsive breakpoints

**Target Devices**:
- Mobile phones (320px - 768px)
- Tablets (768px - 1024px)
- Desktop computers (1024px+)
- Portrait and landscape orientations

**Design Principles**:
- Mobile-first design approach
- Responsive breakpoints for phone, tablet, and desktop
- Touch-friendly interface elements and spacing
- Optimized layouts for small screens
- Readable text sizes across all devices
- Accessible tap targets (minimum 44px)
- Horizontal scrolling minimized or eliminated

**React Implementation**:
- Material-UI responsive grid system
- CSS media queries for custom responsive behavior
- Responsive typography and spacing
- Mobile-optimized navigation patterns
- Touch gesture support where appropriate
- Responsive data tables with horizontal scroll fallback

**User Experience Considerations**:
- Museum staff need mobile access for field work
- Researchers may access on various devices
- Public API consumers expect mobile-responsive interfaces
- Complex data entry may require desktop optimization
- Batch editing features need tablet-friendly design

**Testing Requirements**:
- Cross-device testing on actual devices
- Browser responsive design tools testing
- Performance testing on mobile networks
- Touch interaction testing
- Orientation change testing

### Automated Testing

**axe-core** runs automatically in development:
- Checks run on every page load
- Violations logged to console
- Fix before committing

**Manual checks** still required:
- Keyboard navigation workflow
- Screen reader announcements
- Touch target sizing
- Color contrast (visual verification)

**Additional Testing**:
- Automated accessibility testing integrated into CI/CD (axe-core)
- Manual keyboard navigation testing for all workflows
- Screen reader testing with NVDA, JAWS, and VoiceOver
- Color contrast validation tools
- Regular accessibility audits during development

---

## Semantic HTML

### Use Proper Elements

**Headings**:
```typescript
<Typography variant="h4" component="h1">Items</Typography>  // Page title
<Typography variant="h6" component="h2">Filters</Typography> // Section
```

**Lists**:
```typescript
<List>
  <ListItem>Item 1</ListItem>
  <ListItem>Item 2</ListItem>
</List>
```

**Navigation**:
```typescript
<nav aria-label="Site navigation">
  <List>
    <ListItem><Link to="/items">Items</Link></ListItem>
    ...
  </List>
</nav>
```

**Don't**:
- `<div>` for buttons (use `<Button>`)
- `<div>` for links (use `<Link>` or `<a>`)
- Skipping heading levels (h1 to h3, skip h2)

---

## ARIA Patterns

### Labels

**Form fields** - always have labels:
```typescript
<TextField
  id="catalog-number-input"
  label="Catalog Number"
  aria-label="Catalog Number"
  aria-required="true"
  value={value}
  onChange={handleChange}
/>
```

**Icon buttons** - always have aria-label:
```typescript
<IconButton 
  aria-label="Edit catalog number"
  onClick={handleEdit}
>
  <EditIcon />
</IconButton>

<IconButton
  aria-label="Delete item"
  onClick={handleDelete}
>
  <DeleteIcon />
</IconButton>
```

### Descriptions

**Complex interactions**:
```typescript
<Box>
  <TextField
    id="creation-date"
    label="Creation Date"
    aria-describedby="date-format-help"
    value={value}
  />
  <Typography id="date-format-help" variant="caption">
    Accepted formats: YYYY, YYYY/MM, YYYY/MM/DD, YYYY-YYYY
  </Typography>
</Box>
```

### Live Regions

**For dynamic content** (screen reader announcements):

```typescript
const [announcement, setAnnouncement] = useState('');

<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  style={{ position: 'absolute', left: '-10000px' }}
>
  {announcement}
</div>

// Usage
setAnnouncement(`${count} items loaded`);
```

**Politeness levels**:
- `polite`: Non-urgent updates (counts, success messages)
- `assertive`: Urgent updates (errors, warnings)

---

## Keyboard Navigation

### Tab Order

**Logical flow**: Top to bottom, left to right

**Focus management**:
```typescript
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (editMode) {
    inputRef.current?.focus();
  }
}, [editMode]);

<TextField inputRef={inputRef} />
```

### Keyboard Shortcuts

**Standard shortcuts**:
- Enter: Submit/confirm
- Escape: Cancel/close
- Tab: Next field
- Shift+Tab: Previous field
- Arrow keys: Navigation (lists, dropdowns)

**Implementation**:
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSave();
  } else if (e.key === 'Escape') {
    handleCancel();
  }
};

<TextField
  onKeyDown={handleKeyDown}
  value={value}
/>
```

### Skip Links

**For long pages**, provide skip to content:

```typescript
<Link
  href="#main-content"
  sx={{
    position: 'absolute',
    left: '-10000px',
    '&:focus': {
      position: 'static',
      left: 'auto',
    }
  }}
>
  Skip to main content
</Link>

<main id="main-content">
  {/* Page content */}
</main>
```

---

## Focus Management

### Dialogs and Modals

**Auto-focus** first interactive element:

```typescript
<Dialog open={open} onClose={handleClose}>
  <DialogTitle id="dialog-title">Confirm Delete</DialogTitle>
  <DialogContent>
    <DialogContentText>
      Are you sure you want to delete this item?
    </DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose} autoFocus>
      Cancel
    </Button>
    <Button onClick={handleConfirm} color="error">
      Delete
    </Button>
  </DialogActions>
</Dialog>
```

**Focus trap**: MUI Dialog handles automatically.

### After Delete/Remove

**Return focus** to logical element:

```typescript
const buttonRef = useRef<HTMLButtonElement>(null);

const handleDelete = async (id: number) => {
  await api.delete(`/items/${id}/`);
  // Focus returns to button
  buttonRef.current?.focus();
};

<Button ref={buttonRef} onClick={handleDelete}>
  Delete Item
</Button>
```

---

## Touch Targets

### Minimum Size

**44px × 44px** for all interactive elements:

```typescript
<IconButton
  sx={{
    minWidth: 44,
    minHeight: 44,
    padding: '10px',
  }}
>
  <EditIcon />
</IconButton>
```

**MUI default**: Most components already meet this.

**Check**: Custom components, densely packed layouts.

---

## Color and Contrast

### Text Contrast

**Minimum ratios** (WCAG 2.1 AA):
- Regular text: 4.5:1
- Large text (18pt+, 14pt+ bold): 3:1
- UI components: 3:1

**MUI theme** provides accessible defaults:
- `text.primary`: High contrast (typically 87% opacity black)
- `text.secondary`: Medium contrast (60% opacity)
- `text.disabled`: Low contrast (38% opacity)

**Use theme colors**:
```typescript
<Typography color="text.primary">High contrast</Typography>
<Typography color="text.secondary">Medium contrast</Typography>
```

### Don't Rely on Color Alone

**Wrong**:
```typescript
<Chip label="Invalid" sx={{ backgroundColor: 'red' }} />
```

**Correct**:
```typescript
<Chip 
  label="Invalid - Not found in database"
  icon={<ErrorIcon />}
  sx={{ 
    backgroundColor: 'error.light',
    color: 'error.dark',
    border: '2px solid',
    borderColor: 'error.main'
  }}
/>
```

**Use**: Color + icon + text + border for multiple cues.

---

## Screen Readers

### Alternative Text

**Images**:
```typescript
<img src={logo} alt="NAL Archive logo" />
<Avatar src={photo} alt={`Photo of ${name}`} />
```

**Decorative images**:
```typescript
<img src={decoration} alt="" />  // Empty alt for decorative
```

### Hidden Content

**Visually hidden** but screen-reader accessible:

```typescript
<Box
  component="span"
  sx={{
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  }}
>
  Additional context for screen readers
</Box>
```

**Use For**: Extra context, instructions, announcements.

### Table Accessibility

**Headers**:
```typescript
<Table>
  <TableHead>
    <TableRow>
      <TableCell component="th" scope="col">Catalog Number</TableCell>
      <TableCell component="th" scope="col">Description</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>{item.catalog_number}</TableCell>
      <TableCell>{item.description}</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Caption** (optional but helpful):
```typescript
<Table>
  <caption>List of {items.length} archived items</caption>
  ...
</Table>
```

---

## Form Accessibility

### Labels and Descriptions

**Every input** needs a label:

```typescript
<TextField
  id="catalog-number"
  label="Catalog Number"
  value={value}
  error={!!error}
  helperText={error || 'Unique identifier for this item'}
  required
  aria-required="true"
/>
```

### Error Messages

**Associate errors** with fields:

```typescript
<FormControl error={!!error}>
  <InputLabel id="resource-type-label">Resource Type</InputLabel>
  <Select
    labelId="resource-type-label"
    id="resource-type"
    value={value}
    aria-describedby="resource-type-error"
  >
    {options}
  </Select>
  {error && (
    <FormHelperText id="resource-type-error">{error}</FormHelperText>
  )}
</FormControl>
```

### Required Fields

**Visual + programmatic indicators**:

```typescript
<TextField
  label="Catalog Number"
  required  // Visual asterisk
  aria-required="true"  // Programmatic
  error={submitted && !value}
  helperText={submitted && !value ? 'This field is required' : ''}
/>
```

---

## Testing Checklist

### Automated (axe-core)
- [ ] No violations in console
- [ ] All critical issues resolved
- [ ] Warnings addressed if possible

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Logical tab order (top to bottom, left to right)
- [ ] Enter activates buttons/links
- [ ] Escape closes dialogs/editors
- [ ] Arrow keys work in lists/dropdowns
- [ ] No keyboard traps

### Screen Reader (NVDA/JAWS/VoiceOver)
- [ ] Page title announced on navigation
- [ ] Headings navigable (H key)
- [ ] Landmarks navigable (D key)
- [ ] Form fields have labels
- [ ] Error messages announced
- [ ] Dynamic content changes announced
- [ ] Button purposes clear

### Visual
- [ ] Focus indicators visible (not removed)
- [ ] Color contrast sufficient (4.5:1 text, 3:1 UI)
- [ ] Touch targets >=44px
- [ ] Text resizable to 200% without loss
- [ ] No horizontal scrolling (mobile)

### Mobile/Touch
- [ ] Touch targets adequate size
- [ ] Gestures work (tap, long-press)
- [ ] No hover-only interactions
- [ ] Orientation agnostic (portrait/landscape)

---

## MUI Accessibility Features

### Built-In Support

**Most MUI components** have accessibility built-in:
- Button: Proper focus, keyboard activation
- TextField: Labels, error associations
- Select: ARIA roles, keyboard navigation
- Dialog: Focus trap, Escape handling
- Table: Semantic table structure

**Use them** - don't reinvent.

### Customization

**Extend**, don't replace:

```typescript
<Button
  variant="contained"
  aria-label="Save changes to item"  // Enhance
  startIcon={<SaveIcon />}
>
  Save
</Button>
```

---

## Common Violations

### Missing Labels
```typescript
// WRONG
<TextField value={value} onChange={handleChange} />

// CORRECT
<TextField label="Catalog Number" value={value} onChange={handleChange} />
```

### Button vs Link Confusion
```typescript
// WRONG - navigation with button
<Button onClick={() => navigate('/items')}>View Items</Button>

// CORRECT - navigation with link
<Button component={RouterLink} to="/items">View Items</Button>
```

### Insufficient Contrast
```typescript
// WRONG
<Typography sx={{ color: '#999' }}>Text</Typography>  // Too light

// CORRECT
<Typography color="text.secondary">Text</Typography>  // MUI ensures contrast
```

### Empty Links
```typescript
// WRONG
<Link to="/items"><EditIcon /></Link>

// CORRECT
<Link to="/items" aria-label="Edit item">
  <EditIcon />
</Link>
```

---

## Resources

### Testing Tools
- **axe-core**: Automated testing (built-in)
- **NVDA**: Windows screen reader (free)
- **JAWS**: Windows screen reader (paid)
- **VoiceOver**: macOS/iOS screen reader (built-in)
- **Color Contrast Analyzer**: Desktop app for checking ratios

### References
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MUI Accessibility Guide](https://mui.com/material-ui/guides/accessibility/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

---

**See also**:
- `frontend.md` - React component patterns
- `../00-ESSENTIAL/quickstart.md` - Development workflow
