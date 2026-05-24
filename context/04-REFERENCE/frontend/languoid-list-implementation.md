# Languoid list implementation (reference)

**Context note (2025-10-28, revised periodically):** Languoid list-only patterns (load-once, client filter, tree pagination). **Primary code:** `frontend/src/components/languoids/LanguoidsList.tsx`.

**CRITICAL:** Patterns here are **LANGUOID-SPECIFIC ONLY**. Do **not** copy load-all + client-only filtering or smart pagination to Items, Collaborators, Collections, or Documents without PM approval. See also `list-page-patterns.md` (languoid exception warning).

---

## 1. Frontend-only filtering (languoid_list_001)

- Load full dataset once: `page_size: '10000'`; **no** refetch on filter change.
- State: `allLanguoids`; `filteredLanguoids` via `useMemo`; hierarchy derives from filtered set.
- Filters: level presets, advanced level, search (name, ISO, glottocode, region, tribes), family, region.
- **Why only languoids:** Bounded dataset (~10k max assumption); fits memory; Items/Collaborators can be 10k+ and need server pagination / Redis patterns.

## 2. Hierarchical tree fix (languoid_list_002)

- **Bug:** Children used `parent_languoid === id OR family_languoid === id`, breaking indentation after first families.
- **Fix:** Children = `parent_languoid === languoid.id` only (direct parent FK traversal).

## 3. Smart pagination (languoid_list_003)

- **minPageSize** ~50; dynamic `pageBreaks` at **top-level** boundaries (`indentLevel === 0`) so subtrees are not split across pages.
- Algorithm (conceptual): advance index by min size, scan forward to next root row, break; repeat.

## 4. Scroll-to-top (languoid_list_004)

- **Issue:** immediate `window.scrollTo` raced render.
- **Fix:** `listTopRef` + `useEffect` on `displayPage` → `scrollIntoView({ behavior: 'smooth', block: 'start' })`. Reusable pattern for other lists with similar bugs.

## 5. Languages and dialects preset (languoid_list_005)

- When preset is `languages_dialects`: languages as roots (sorted); dialects nested; orphans promoted to root. Other presets use full family/subfamily/language/dialect hierarchy.

## 6. Results counter (languoid_list_006)

- Show dynamic slice range using `pageBreaks`, filtered total, optional per-page count, and total `allLanguoids.length` when filters active.

---

## Patterns established (summary)

- Smart pagination applies only where hierarchy + full client dataset exist.
- Frontend-only filtering requires bounded cardinality and PM sign-off for other models.
