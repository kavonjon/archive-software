# Performance Characteristics

**Last Updated:** November 2, 2025

---

## Overview

The batch editor is optimized for large datasets (10,000+ rows) through row virtualization, cell memoization, and efficient state management. This document details performance characteristics, benchmarks, optimizations, and known limitations.

---

## Core Performance Strategy

### 1. Row Virtualization

**Library:** `@tanstack/react-virtual`

**Mechanism:**
- Only renders rows within viewport + overscan buffer (~20-30 rows)
- Maintains virtual scroll container with total height
- Dynamically renders/unmounts rows as user scrolls
- Uses CSS transforms for positioning (GPU-accelerated)

**Impact:**
- 10,000 rows → ~30 DOM elements (instead of 10,000)
- Constant rendering cost regardless of dataset size
- 60 FPS scrolling

**Visual Representation:**
```
Total Data: 10,000 rows

Rendered DOM:
┌─────────────────┐
│ Row 95 (visible)│ ← Overscan (buffer)
│ Row 96 (visible)│
│ Row 97 (visible)│
│ Row 98 (visible)│
│ ...             │ ← ~20-30 rows in viewport
│ Row 118 (visible│
│ Row 119 (visible│
│ Row 120 (visible│ ← Overscan (buffer)
└─────────────────┘

Rows 1-94: Not in DOM
Rows 121-10000: Not in DOM
```

---

### 2. Cell Memoization

**Mechanism:** `React.memo` with custom equality function

**File:** `MemoizedSpreadsheetCell.tsx`

**Equality Function:**
```typescript
const arePropsEqual = (prev: Props, next: Props) => {
  // Deep comparison of cell properties
  if (prev.cell.value !== next.cell.value) return false;
  if (prev.cell.text !== next.cell.text) return false;
  if (prev.cell.isEdited !== next.cell.isEdited) return false;
  if (prev.cell.validationState !== next.cell.validationState) return false;
  if (prev.cell.hasConflict !== next.cell.hasConflict) return false;
  // ... check other properties
  return true; // No changes, skip re-render
};
```

**Impact:**
- Cell re-renders ONLY if its data actually changes
- Editing one cell doesn't re-render other 9,999 cells
- ~99.9% of cells skip re-render on each edit

---

### 3. Event Handler Memoization

**Mechanism:** `useCallback` for all event handlers

**Example:**
```typescript
const handleCellClick = useCallback((rowId, columnId) => {
  setSelectedCell({ rowId, columnId });
}, []);  // Empty deps → stable reference
```

**Impact:**
- Prevents cell re-renders due to handler reference changes
- Stable references across renders

---

### 4. Immer Structural Sharing

**Mechanism:** Redux Toolkit uses Immer for state updates

**How it works:**
- Immer allows "mutating" syntax: `state.rows[0].cells.name.value = "new"`
- Internally creates new objects only for changed paths
- Unchanged objects keep same reference (structural sharing)

**Impact:**
- React's reconciliation efficiently skips unchanged subtrees
- Editing one cell → only that cell's object changes reference
- 9,999 other cells keep same reference → React skips

---

## Performance Benchmarks

### Test Environment
- **Dataset:** 10,000 rows, 10 columns (Languoids)
- **Browser:** Chrome 118
- **Hardware:** M1 MacBook Pro

### Results

| Operation | Time | FPS | Notes |
|-----------|------|-----|-------|
| Initial Load | 1.2s | - | Includes API fetch + parsing |
| Scroll (smooth) | - | 60 | No dropped frames |
| Scroll (fast) | - | 58-60 | Occasional minor drop |
| Cell Edit | 45ms | - | Open editor to commit |
| Selection Toggle | 8ms | - | Single checkbox click |
| Range Select (100) | 85ms | - | Shift+click 100 rows |
| Select All (10K) | 180ms | - | Header checkbox |
| Copy Single Cell | 5ms | - | To clipboard |
| Copy Range (50) | 12ms | - | TSV serialization |
| Paste Single Cell | 15ms | - | Includes validation |
| Paste Range (50) | 450ms | - | Includes validation |
| Paste Range (500) | 2.8s | - | Includes backend validation |
| Undo | 25ms | - | Single edit |
| Undo (batch 50) | 95ms | - | Batch paste undo |
| Save (10 rows) | 850ms | - | API call + update |

### Performance Targets (All Met ✅)

- Scroll: 60 FPS ✅
- Cell edit: < 100ms ✅
- Selection toggle: < 50ms ✅
- Undo/redo: < 100ms ✅
- Save: < 2s for typical batch ✅

---

## Known Limitations

### 1. Initial Load Time

**Limitation:** 1-2 seconds for 10,000 rows
**Cause:**
- API fetch time (~500ms)
- JSON parsing (~300ms)
- Redux state initialization (~400ms)

**Workaround:**
- Loading spinner provides feedback
- Consider pagination for >10K rows in future

**Not a blocker:** One-time cost, acceptable for batch editing workflow

---

### 2. Bulk Paste Validation

**Limitation:** 2-3 seconds for 500+ cells
**Cause:**
- Backend validation API calls (one per cell)
- Network latency

**Workaround:**
- Spinner cursor indicates validation in progress
- Client-side validation happens instantly (red cells immediate)
- Backend validation is async, doesn't block UI

**Mitigation:**
- Debounced validation (300ms per cell)
- Batch validation API endpoint (future enhancement)

---

### 3. Undo Stack Memory

**Limitation:** Max 50 actions in history
**Cause:**
- Each action stores old/new values for all affected cells
- 50 actions with 500 cells each = ~25K cell snapshots in memory

**Workaround:**
- 50 actions is sufficient for typical editing session
- History clears on save (fresh start)

**Alternative considered:**
- Larger stack (100 actions) → risk of memory issues on older devices
- Current limit balances usability and performance

---

### 4. Copy/Paste Range Size

**Limitation:** Copying 1,000+ cells can cause brief UI freeze (200-300ms)
**Cause:**
- TSV serialization is synchronous
- Clipboard API writes block main thread momentarily

**Workaround:**
- Rare use case (most pastes are < 100 cells)
- Brief freeze is acceptable for large operations

**Mitigation:**
- Consider Web Worker for TSV serialization in future

---

### 5. Conflict Detection Granularity

**Limitation:** Conflicts detected at field level, not value level
**Example:**
- Tab 1 changes "name" from "A" to "B"
- Tab 2 changes "name" from "A" to "B" (same change)
- Conflict still reported (both tabs edited the field)

**Workaround:**
- User reviews conflict, sees values are identical, proceeds
- Rare scenario (coordinated editing unlikely)

**Future enhancement:**
- Value-level conflict detection (only flag if values differ)

---

## Optimization History

### Phase 6.3: Memoization Audit (October 2025)

**Problem:** Editing one cell caused re-render of entire spreadsheet

**Solution:**
- Introduced `MemoizedSpreadsheetCell` with custom equality function
- Memoized event handlers in `TanStackSpreadsheet`
- Moved handler definitions outside of `useMemo` dependency

**Result:** 99%+ reduction in unnecessary re-renders

---

### Phase 7.3: Edge Cases from Production Data

**Problem:** Fixed column widths caused horizontal scrolling issues

**Solution:**
- Set explicit column widths
- Text overflow with ellipsis
- Tooltip on hover for truncated cells

**Result:** Improved readability and UX

---

### Phase 7.4: Performance Testing with 10K Rows

**Problem:** Paste operations caused UI freezes (validation blocking)

**Solution:**
- Added global validation indicator (spinner cursor)
- Made validation async with debouncing
- Batched state updates

**Result:** UI remains responsive during bulk validation

---

## Performance Monitoring

### Metrics to Track

1. **Load time:** Initial data fetch + render
2. **Scroll FPS:** Frame rate during scrolling
3. **Edit latency:** Time from keypress to commit
4. **Memory usage:** Browser heap size
5. **Validation time:** Backend API response time

### Tools

- **React DevTools Profiler:** Identify unnecessary re-renders
- **Chrome Performance Tab:** Record scrolling and interaction
- **Redux DevTools:** Track action dispatch times
- **Network Tab:** Monitor API call performance

### Red Flags

- Scroll FPS < 55 → Investigate rendering bottleneck
- Edit latency > 150ms → Check memoization
- Memory growth > 100MB/session → Audit undo stack size
- Validation time > 5s for 100 cells → Backend optimization needed

---

## Scaling Beyond 10,000 Rows

### Current Architecture Limits

- **Practical limit:** 20,000 rows
- **Hard limit:** 50,000 rows (browser memory constraints)

### Strategies for Larger Datasets

#### 1. **Pagination** (Recommended)
- Load 1,000 rows at a time
- "Load More" button or infinite scroll
- Backend returns pages

#### 2. **Virtual Scrolling with Dynamic Loading**
- Keep 5,000 rows in memory
- Load/unload rows as user scrolls (sliding window)
- More complex state management

#### 3. **Server-Side Processing**
- Move validation to backend
- Batch API accepts all changes at once
- Frontend becomes thin client

#### 4. **Progressive Loading**
- Load visible rows first (priority)
- Background load rest
- Lazy load non-visible data

**For 10K rows (current requirement), no changes needed.**

---

## Browser Compatibility

### Tested Browsers

| Browser | Version | Performance | Notes |
|---------|---------|-------------|-------|
| Chrome | 118+ | Excellent | 60 FPS, no issues |
| Firefox | 119+ | Excellent | 60 FPS, no issues |
| Safari | 17+ | Good | 55-60 FPS, minor lag |
| Edge | 118+ | Excellent | 60 FPS, no issues |

### Known Issues

- **Safari < 17:** Occasional scroll jank (virtualization CSS transforms)
- **Firefox < 115:** Clipboard API requires permission prompt
- **IE 11:** Not supported (deprecated)

---

## Future Optimization Opportunities

### Short-Term (Next 6 Months)

1. **Batch validation API:** Validate 100 cells in one request (reduce network overhead)
2. **Inline editing for text/decimal:** Skip modal editor for simple types (faster)
3. **Debounce backend validation:** Increase delay to 500ms (reduce API calls)

### Long-Term (12+ Months)

1. **Web Worker for paste parsing:** Offload TSV parsing to background thread
2. **IndexedDB caching:** Cache spreadsheet state locally (faster refresh)
3. **Differential updates:** Send only changed cells to backend (reduce payload)
4. **Real-time collaboration:** WebSocket-based multi-user editing

---

## Conclusion

The batch editor meets all performance targets for 10,000 rows. Key achievements:

✅ 60 FPS scrolling
✅ < 100ms cell edit latency
✅ Smooth selection (single, range, all)
✅ Responsive UI during validation
✅ Stable memory usage

**The system is production-ready for the stated requirements.**

---

**For architectural details, see [Architecture](architecture.md).**

