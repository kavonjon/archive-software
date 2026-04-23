# MultiSelectCell and ReactGrid focus (Stage 1)

**Context note (2025-10-19):** ReactGrid + multi-step cell editing; this lesson matches production behavior in `frontend/src/components/batch/cells/MultiSelectCell.tsx`.

**Problem:** MultiSelectCell closed the editor after every chip add/remove, making multi-select unusable.

**Expected flow:** Open editor; add/remove chips with editor **staying open**; **Enter** commits to Redux and closes; reopen shows saved chips.

**Root cause:** Each `setSelectedOptions` (React state) caused a re-render; the search input ref was unmounted/remounted; ReactGrid treated that as focus loss and exited edit mode. Refocus via `setTimeout` was too late.

**Solution pattern:**

1. **Static storage** for pending selections: `private static pendingSelections = new Map<string, MultiSelectOption[]>()` on the cell template class.
2. **forceUpdate** counter to re-render only the cell view after Map updates—avoid Redux and avoid `onCellChanged` until commit.
3. **handleSelect / handleRemove:** Update Map only; call `forceUpdate`; do not commit during intermediate steps.
4. **Enter:** Read Map, build final cell, `onCellChanged(finalCell, true)`.
5. **Escape:** Clear static Map entries for the cell; blur search input; **do not** `preventDefault`/`stopPropagation` on Escape so ReactGrid’s template handler can exit edit mode.
6. **Cleanup:** On exit (Enter/Escape/delete), remove keys from static Map and any parallel `editingCells` Set.

**Principle:** Single-action cells (SelectCell, RelationshipCell) can use `useState`. **Multi-action** cells that accumulate edits before one commit should use **static class storage** (or an equivalent non-focus-busting store), not React state per chip.

**Applies to:** Any future multi-step-in-one-edit-session cell (date range, multi-tag, multi-file picker).

**Testing:** Open editor; add multiple chips without close; remove chip; Enter commits; Escape discards; reopen matches saved state.
