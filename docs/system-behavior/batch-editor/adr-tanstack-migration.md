# Architecture Decision Record: Migrate from ReactGrid to TanStack Table

**Date:** 2025-10-31  
**Status:** Accepted  
**Deciders:** Development Team, Product Owner  
**Decision:** Migrate batch editing spreadsheet from ReactGrid to TanStack Table + React Virtual  

---

## Context

The batch editing feature (Stage 1) requires displaying and editing up to **10,000 rows** of languoid data in a spreadsheet interface. The current implementation uses ReactGrid (`@silevis/reactgrid`), which provides an Excel-like UX out of the box.

### Requirements
1. Display and edit 10,000 rows without performance degradation
2. Support 8 complex cell types (text, select, relationship, multiselect, boolean, date, stringarray, decimal)
3. Spreadsheet UX: cell selection, keyboard navigation, copy/paste
4. Multi-action editing (e.g., add/remove multiple tags without closing editor)
5. Real-time validation and dirty state tracking
6. FOSS (Free and Open Source Software) licensing

---

## Problem Statement

During performance testing, ReactGrid exhibited critical failures:

### Test Results (2025-10-31)

| Row Count | Result | Evidence |
|-----------|--------|----------|
| 100 rows | ✅ Works | All operations < 1ms |
| 500 rows | ✅ Works | All operations < 1ms |
| **1,000 rows** | ❌ **OUT OF MEMORY** | `Uncaught out of memory` (×8), `DOMException: object could not be cloned`, React errors (×100) |
| 2,500 rows | ❌ **UNUSABLE** | 10+ second load, only 38 rows visible, blank after scroll |
| 10,000 rows | ❌ **IMPOSSIBLE** | Never reached |

### Root Cause

ReactGrid **does not virtualize** rows. It renders all rows to the DOM:
- 100 rows = 100 DOM nodes → Works
- 1,000 rows = 1,000 DOM nodes → JavaScript heap exhausted
- 10,000 rows = 10,000 DOM nodes → Impossible

**No amount of optimization can fix this fundamental architecture limitation.**

### Previous Optimization Attempts

We implemented multiple optimizations:
1. **Row-level memoization:** Cache row transformations to prevent unnecessary re-renders
2. **Ref-based callbacks:** Prevent callback recreation on every state change
3. **Lazy `isDirty`:** Compute dirty state on-demand instead of on every edit

**Result:** These optimizations improved performance for < 500 rows, but could not overcome ReactGrid's non-virtualized architecture.

---

## Decision

**Migrate from ReactGrid to TanStack Table + React Virtual.**

### Rationale

1. **TanStack Table is proven to handle 10,000 rows:**
   - Spike test: smooth scrolling, no lag, no memory issues
   - Virtualization: only ~20-30 DOM nodes rendered at a time
   - MultiSelectCell integration: successful

2. **FOSS and well-maintained:**
   - MIT License
   - TanStack ecosystem (20M+ downloads/month)
   - Active development, modern React patterns

3. **Headless architecture = maximum control:**
   - Build exactly the UX we need
   - No fighting library limitations
   - Full control over performance optimization

4. **We already have working cell logic:**
   - 8 cell types already implemented for ReactGrid
   - Can port to TanStack with minimal changes
   - Spike proved MultiSelectCell works

5. **No viable alternatives:**
   - **react-data-grid:** No clipboard support, broken MultiSelectCell in testing
   - **AG Grid:** Community edition lacks features we need (not truly FOSS for our use case)
   - **MUI X Data Grid:** Similar licensing concerns, still evaluating performance
   - **ReactGrid:** Cannot scale (proven failure)

---

## Consequences

### Positive

- ✅ **Meets 10,000 row requirement** (proven in spike)
- ✅ **Full control** over UX and performance
- ✅ **Modern tech stack** (TanStack ecosystem)
- ✅ **FOSS licensing** (MIT)
- ✅ **Can reuse existing cell logic** (627-line MultiSelectCell, etc.)
- ✅ **Future-proof** (headless architecture adapts to any UI framework)

### Negative

- ❌ **Significant development effort:** 85-121 hours (2-3 weeks)
- ❌ **Custom spreadsheet UX:** Must build selection, keyboard nav, copy/paste ourselves
- ❌ **Risk of quality gap:** Our custom UX might not match ReactGrid's polish
- ❌ **Testing burden:** More code = more tests
- ❌ **Maintenance:** We own the spreadsheet layer now

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Custom UX doesn't match ReactGrid quality** | High | Medium | Iterative testing, frequent demos, user feedback |
| **Unexpected performance bottlenecks** | High | Low | Early profiling, incremental optimization |
| **Timeline overrun (> 3 weeks)** | Medium | Medium | Staged rollout, reduce scope if needed |
| **Copy/paste edge cases** | Medium | Medium | Comprehensive test coverage, strict type checking |
| **Cell editor porting issues** | Low | Low | Side-by-side testing, regression tests |

---

## Alternatives Considered

### Alternative 1: Continue with ReactGrid + Pagination
**Approach:** Accept 500-row limit, implement pagination (50 rows per page)

**Pros:**
- ✅ Zero migration effort
- ✅ Works within ReactGrid's capabilities

**Cons:**
- ❌ Violates 10,000-row requirement
- ❌ Poor UX (switching pages mid-edit)
- ❌ Doesn't solve the underlying problem

**Rejected:** Does not meet requirements.

---

### Alternative 2: AG Grid Community Edition
**Approach:** Migrate to AG Grid's free tier

**Pros:**
- ✅ Handles 10K+ rows
- ✅ Spreadsheet UX built-in
- ✅ Large ecosystem

**Cons:**
- ❌ Community edition lacks key features (custom editors, complex filtering)
- ❌ Licensing ambiguity (need Enterprise for our use case?)
- ❌ Heavier library (larger bundle size)

**Rejected:** Licensing concerns, unclear feature availability in Community edition.

---

### Alternative 3: react-data-grid (adazzle)
**Approach:** Migrate to react-data-grid

**Testing Results (3 iterations, 2025-10-31):**
- ✅ Handles 10K rows
- ⚠️ MultiSelectCell dropdown broken (couldn't fix in 3 iterations)
- ❌ No built-in copy/paste (requires custom implementation)
- ❌ Keyboard shortcuts broken (Escape, Enter)

**Rejected:** Critical features don't work, would require similar effort to TanStack but with less control.

---

### Alternative 4: Build from Scratch (No Library)
**Approach:** Build entire spreadsheet with pure React + DOM virtualization

**Pros:**
- ✅ Maximum control

**Cons:**
- ❌ Enormous effort (200+ hours)
- ❌ Reinventing the wheel
- ❌ No ecosystem/community support

**Rejected:** Excessive effort, no advantage over TanStack approach.

---

## Implementation Plan

See detailed breakdown in `tanstack-migration-plan.md`.

### Timeline
- **Week 1:** Core infrastructure, selection, editing (33-47 hours)
- **Week 2:** Cell types, copy/paste, validation (32-44 hours)
- **Week 3:** Performance, testing, cutover (20-30 hours)

**Total: 85-121 hours (mid-point: ~100 hours)**

### Critical Path
```
Core Infrastructure (P0)
  ↓
Cell Selection (P0)
  ↓
Cell Editing (P0)
  ↓
Cell Types (P0) ← Longest phase (15-20h)
  ↓
Testing (P1)
  ↓
Cutover (P0)
```

### Success Criteria
- [ ] Handles 10,000 rows without out-of-memory errors
- [ ] Initial render < 2 seconds
- [ ] Cell edit commit < 100ms
- [ ] All 8 cell types functional
- [ ] Copy/paste works (basic and complex types)
- [ ] Keyboard navigation works
- [ ] 90%+ visual parity with ReactGrid
- [ ] No data loss in production

### Rollback Plan
1. **Feature flag:** Beta users test TanStack, stable users stay on ReactGrid
2. **Staged rollout:** Migrate one model at a time (Languoids first)
3. **Full rollback:** If critical issues found, revert to ReactGrid + accept 500-row limit

---

## References

### Evidence Documents
- Performance test results: See `ReactGridPerformanceSpike.tsx` (2025-10-31)
- TanStack spike: See `TanStackTableSpike.tsx` (2025-10-31)
- react-data-grid spike: See `ReactDataGridSpike.tsx` (2025-10-31)

### Related Decisions
- **Stage 1 Architecture:** Context memory `stage1_batch_editing.json`
- **ReactGrid Selection:** Original choice documented in Stage 1 requirements

### External Links
- [TanStack Table Docs](https://tanstack.com/table/latest)
- [TanStack Virtual Docs](https://tanstack.com/virtual/latest)
- [ReactGrid Docs](https://reactgrid.com/docs) (legacy)
- [react-data-grid GitHub](https://github.com/adazzle/react-data-grid) (evaluated)

---

## Approval

**Approved by:** [To be filled]  
**Date:** [To be filled]  
**Next Review:** After Phase 1 completion (Core Infrastructure)

---

## Notes

### Lessons Learned

1. **Test at scale early:** We should have tested ReactGrid with 10K rows before full implementation
2. **Virtualization is non-negotiable:** Any grid library for 10K+ rows MUST virtualize
3. **Spike testing is valuable:** TanStack spike saved us weeks of wrong-direction effort
4. **Headless architectures offer flexibility:** Worth the extra UX implementation effort

### Future Considerations

- **Other models:** If migration succeeds for Languoids, apply to Items, Collections, etc.
- **Column virtualization:** If we need 50+ columns, consider virtualizing columns too
- **Performance monitoring:** Add telemetry to track real-world performance metrics
- **Accessibility audit:** Ensure keyboard nav and screen reader support are excellent

---

**Status:** ✅ **Accepted**  
**Implementation:** ⏳ **Starting Phase 1**

