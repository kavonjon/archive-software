# System Behavior Documentation

**Last Updated:** October 29, 2025  
**Purpose:** Technical documentation of system logic, algorithms, and processing workflows  
**Audience:** Technical users, system administrators, developers understanding system internals

---

## Table of Contents

- [Languoid Model](#languoid-model)
  - [Automatic Signal Processing](#automatic-signal-processing)

---

## Languoid Model

Languoids represent languages and dialects in a hierarchical tree structure. The system maintains data integrity through automatic field derivation and cascading updates.

### Core Concepts

**Hierarchical Structure:**
- Languoids form a tree using a self-referential `parent_languoid` relationship
- Level classification: Family → Subfamily → Language → Dialect
- The `parent_languoid` field is the **single source of truth** - all other hierarchy fields are automatically derived

**Level Classification:**
- `level_glottolog`: User-specified classification (family, language, or dialect)
- `level_nal`: Automatically derived granular level (family, subfamily, subsubfamily, language, or dialect)

**Derived Hierarchy Fields:**
- `family_languoid`: Reference to the top-level family ancestor
- `pri_subgroup_languoid`: Reference to the primary subfamily ancestor
- `sec_subgroup_languoid`: Reference to the secondary subsubfamily ancestor
- `descendents`: Many-to-many field containing all descendants in the subtree (cached for performance)

---

### Automatic Signal Processing

When a languoid is saved, the system automatically performs several operations to maintain data integrity and hierarchy consistency. These operations happen in three phases: before save, after save (immediate), and after save (delayed).

#### Phase 1: Before Save (Synchronous)

**Signal:** `compute_languoid_derived_fields`

**When it runs:** Immediately before any languoid is saved to the database

**What it does:**

1. **Detects level changes from 'language':**
   - If the `level_glottolog` is being changed FROM 'language' TO something else (family or dialect)
   - Sets an internal flag `_needs_dialect_orphaning` on the instance
   - Clears language-specific fields: `region`, `longitude`, `latitude`, `tribes`, `notes`
   - Rationale: These fields are only relevant for languages, not families or dialects

2. **Detects parent changes:**
   - If the `parent_languoid` is being changed (moving the languoid to a different parent)
   - Stores the old parent's ID in `_old_parent_id` on the instance
   - Rationale: Needed later to update the old parent's ancestor chain

3. **Derives level_nal:**
   - Automatically calculates `level_nal` based on `level_glottolog` and parent's `level_nal`:
     - If `level_glottolog` is 'dialect' → `level_nal` = 'dialect'
     - If `level_glottolog` is 'language' → `level_nal` = 'language'
     - If `level_glottolog` is 'family':
       - If no parent → `level_nal` = 'family'
       - If parent's `level_nal` is 'family' → `level_nal` = 'subfamily'
       - If parent's `level_nal` is 'subfamily' → `level_nal` = 'subsubfamily'
       - Otherwise → `level_nal` = 'family'

4. **Defaults name abbreviation:**
   - If `name_abbrev` is empty, sets it to the value of `name`

5. **Derives hierarchy foreign keys:**
   - Calculates `family_languoid`, `pri_subgroup_languoid`, and `sec_subgroup_languoid` based on the parent chain:
     - If parent's `level_nal` is 'family' → set `family_languoid` to parent
     - If parent's `level_nal` is 'subfamily' → set `pri_subgroup_languoid` to parent, inherit `family_languoid` from parent
     - If parent's `level_nal` is 'subsubfamily' → set `sec_subgroup_languoid` to parent, inherit `pri_subgroup_languoid` and `family_languoid` from parent
     - If parent's `level_nal` is 'language' (for dialects) → inherit all three fields from parent
     - If parent's `level_nal` is 'dialect' → log warning (invalid configuration)

**Result:** The languoid instance is modified with correct derived values before being written to the database

---

#### Phase 2: After Save - Immediate (Asynchronous)

**Signal:** `schedule_languoid_hierarchy_update`

**When it runs:** Immediately after a languoid is saved to the database

**What it does:**

1. **Checks for duplicate processing:**
   - Uses a 10-second cache key to prevent scheduling duplicate tasks for the same languoid

2. **Extracts flags from the instance:**
   - Retrieves the `_needs_dialect_orphaning` flag (if level changed from 'language')
   - Retrieves the `_old_parent_id` (if parent changed)
   - Cleans up these temporary flags from the instance

3. **Schedules hierarchy update task:**
   - Triggers an asynchronous background task with Priority 9 (highest priority)
   - Passes: languoid ID, orphaning flag, old parent ID

**Background Task:** `update_languoid_hierarchy_task`

**What the task does:**

**Step 1: Orphan dialect children (if needed)**
- If the `_needs_dialect_orphaning` flag is set:
  - Find all direct children where `level_glottolog` = 'dialect'
  - For each dialect child:
    - Set its `parent_languoid` to None (orphan it)
    - Save the child (which triggers its own hierarchy recalculation)
  - Rationale: When a language becomes a family or dialect, it can no longer have dialect children

**Step 2: Update NEW parent's ancestor chain**
- Get the languoid and all its ancestors by traversing up the `parent_languoid` chain
- For each ancestor (including the languoid itself):
  - Calculate all descendants by recursively traversing down the `parent_languoid` relationships
  - Update the `descendents` many-to-many field with the complete list of descendants
- Rationale: The languoid's subtree is now part of the new parent's hierarchy

**Step 3: Update OLD parent's ancestor chain (if parent changed)**
- If an `old_parent_id` was provided:
  - Fetch the old parent languoid
  - Get the old parent and all its ancestors
  - For each old ancestor:
    - Recalculate all descendants (the moved subtree is no longer included)
    - Update the `descendents` many-to-many field
  - Rationale: The moved subtree must be removed from the old parent's hierarchy
- If old parent no longer exists (was deleted), log a warning and continue

**Result:** The `descendents` many-to-many field is correctly updated for all affected ancestors in both the old and new hierarchy branches

---

#### Phase 3: After Save - Delayed (Asynchronous)

**Signal:** `schedule_cascading_dialect_updates`

**When it runs:** Immediately after a languoid is saved to the database

**What it does:**

1. **Checks for duplicate processing:**
   - Uses a 10-second cache key to prevent scheduling duplicate tasks

2. **Schedules delayed cascade task:**
   - Triggers an asynchronous background task with Priority 5 (lower than immediate updates)
   - Delays execution by 3 seconds
   - Rationale: Ensures immediate hierarchy updates complete first to avoid race conditions

**Background Task:** `cascade_hierarchy_to_dialects_task`

**What the task does:**

1. **Finds all dialect descendants:**
   - Recursively traverses down the hierarchy to find all descendants where `level_glottolog` = 'dialect'

2. **Updates each dialect's hierarchy fields:**
   - For each dialect descendant:
     - Recalculates `family_languoid`, `pri_subgroup_languoid`, `sec_subgroup_languoid` based on its current position in the tree
     - The dialect inherits these values from its language parent
     - Saves the updated dialect

**Rationale:** When a family or language's hierarchy changes, all dialect descendants must inherit the new hierarchy. This is delayed to ensure the parent hierarchy is fully updated first.

---

#### Cache Invalidation

**Signal:** `invalidate_languoid_list_cache`

**When it runs:** After any languoid is saved or deleted

**What it does:**

1. **Invalidates Redis cache:**
   - Clears the cached languoid list data used by the frontend

2. **Schedules immediate cache rebuild:**
   - Triggers a background task with Priority 8 to rebuild the cache immediately
   - Rationale: Ensures the next user request gets fresh data quickly

**Result:** The languoid list page always displays up-to-date hierarchy information

---

### Parent Change Example

**Scenario:** Move "Language A1a" from "Subfamily A1" under "Family A" to "Family B"

**Initial State:**
```
Family A
  └─ Subfamily A1
       └─ Language A1a
Family B (empty)
```

**What happens when Language A1a's parent is changed to Family B:**

1. **Before Save:**
   - Detects parent change: Subfamily A1 → Family B
   - Stores old parent ID (Subfamily A1's ID) in `_old_parent_id`
   - Derives new `level_nal`: Language A1a remains 'language'
   - Derives new hierarchy FKs: 
     - `family_languoid` = Family B (parent is a family)
     - `pri_subgroup_languoid` = None
     - `sec_subgroup_languoid` = None
   - Saves to database

2. **After Save (Immediate):**
   - Schedules hierarchy update task with old parent ID
   - Task runs:
     - **Step 1:** No dialect orphaning needed (level didn't change)
     - **Step 2:** Updates NEW parent chain:
       - Family B.descendents = [Language A1a]
     - **Step 3:** Updates OLD parent chain:
       - Subfamily A1.descendents = [] (Language A1a removed)
       - Family A.descendents = [Subfamily A1] (Language A1a removed)

3. **After Save (Delayed):**
   - If Language A1a had dialect children, they would be updated to inherit the new hierarchy FKs

**Final State:**
```
Family A
  └─ Subfamily A1 (empty)
Family B
  └─ Language A1a
```

**Result:** The entire subtree moves cleanly, and all ancestor `descendents` fields are correctly updated.

---

### Level Change Example

**Scenario:** Change "Language X" from level 'language' to level 'family'

**Initial State:**
```
Language X
  └─ Dialect X1
  └─ Dialect X2
```

**What happens when Language X's level_glottolog is changed from 'language' to 'family':**

1. **Before Save:**
   - Detects level change from 'language'
   - Sets `_needs_dialect_orphaning` flag
   - Clears language-specific fields: `region`, `longitude`, `latitude`, `tribes`, `notes`
   - Derives new `level_nal`: 'family' (or 'subfamily' depending on parent)
   - Saves to database

2. **After Save (Immediate):**
   - Schedules hierarchy update task with orphaning flag
   - Task runs:
     - **Step 1:** Orphan dialect children:
       - Dialect X1.parent_languoid = None (orphaned)
       - Dialect X2.parent_languoid = None (orphaned)
     - **Step 2:** Updates descendents for Language X's ancestors
     - **Step 3:** No old parent chain update needed

**Final State:**
```
Language X (now Family X)
Dialect X1 (orphaned, no parent)
Dialect X2 (orphaned, no parent)
```

**Result:** The languoid can now function as a family, and its former dialect children are orphaned (can be manually reassigned to appropriate language parents).

---

## Other Models

*Documentation for other models will be added as needed.*

---

**Note:** This documentation describes system behavior at a conceptual level. For implementation details, see the source code in `app/metadata/signals.py` and `app/metadata/tasks.py`.

