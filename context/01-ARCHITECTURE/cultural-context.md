# Cultural Context

**Last Updated**: 2026-04-23

## Foundational Principle

**Cultural considerations are paramount in all technical decisions affecting data access and visibility.**

This system serves the **Sam Noble Oklahoma Museum of Natural History** at the **University of Oklahoma**, with a mission of supporting Native communities and researchers in **language revitalization and cultural preservation**.

Respect for Native American cultural heritage and community control over cultural materials drives major architectural decisions.

---

## Cultural Sensitivity Requirements

### 4-Level Access System

**Purpose**: Primary technical mechanism for respecting cultural sensitivities and community control.

**Access Levels**:
1. **Open Access** - Materials appropriate for general public access without cultural restrictions
2. **Onsite Viewing Only** - Sensitive materials requiring physical presence
3. **Time-Limited Access** - Materials with temporary restrictions
4. **Depositor-Controlled Access** - Highest sensitivity, community-controlled access

**Rationale**: Different materials require different levels of protection and community control based on cultural significance.

**Technical Integration**: Access levels must be respected throughout all system components:
- Database queries
- API responses
- File access controls
- Public/private server segregation

---

## Dual-Server Cultural Rationale

### Why Two Servers Exist

**Decision**: Dual-deployment architecture exists **primarily** to enable cultural sensitivity controls through data segregation.

**Cultural Driver**: Need to provide public access while maintaining strict control over culturally sensitive materials.

**Technical Solution**: Complete separation of public-appropriate vs restricted materials across different server infrastructures:
- **Public server**: Contains ONLY access level 1 materials
- **Private server**: Contains ALL materials with full access control

This ensures culturally sensitive materials remain on private server only, with no possibility of accidental exposure.

---

## Field-Level Filtering

**Purpose**: Database synchronization includes field-level filtering to exclude sensitive information from public server.

**Approach**: Serializers control which fields are included in:
- Public API responses
- Cross-server sync operations

**Sensitive Field Examples**:
- Internal notes
- Restricted collaborator information
- Detailed cultural context
- Community-specific annotations

**Private server always wins** - No conflict resolution needed. Private server data is authoritative.

---

## Anonymous Collaborator Protection

**Purpose**: Protect cultural safety by allowing anonymous attribution.

**Implementation**: System supports anonymous collaborators without requiring names.

**Cultural Rationale**: Some cultural materials involve collaborators who:
- Prefer cultural anonymity
- Have community-specific privacy needs
- Participate in sensitive ceremonial recordings

**Technical Support**: Collaborator.anonymous field enables this protection.

---

## Ceremonial Content Handling

**Content Types Requiring Special Sensitivity**:
- Music: Ceremonial
- Music: Native American Church
- Music: Sundance
- Prayer
- Traditional stories

**Sensitivity Level**: High

**Access Considerations**: These materials often require:
- Restricted access levels (2, 3, or 4)
- Community consultation before public sharing
- Careful handling of associated metadata
- Respect for ceremonial protocols

---

## Content Types by Cultural Significance

**Linguistic Materials** (Language preservation focus):
- Audio/video recordings (languages, dialects)
- Educational materials
- Linguistic documentation
- Community language resources

**Cultural Materials** (Ceremonial significance):
- Ceremonial recordings
- Traditional music
- Prayers and spiritual content
- Cultural practice documentation

**Historical/Ethnographic**:
- Interviews
- Narratives
- Historical accounts
- Ethnographic documentation

**Published Works**:
- Books and articles
- Theses and dissertations
- Manuscripts
- Research publications

**Visual Materials**:
- Photographs
- Images
- 3D objects
- Ephemera

---

## Architectural Influence

**How Cultural Requirements Drive Technical Decisions**:

1. **Dual-server architecture** - Segregate sensitive materials
2. **Access level system** - Graduated protection mechanisms
3. **Field-level filtering** - Exclude sensitive metadata from public sync
4. **Anonymous support** - Protect contributor identity
5. **Permission groups** - Control who can modify cultural materials
6. **Audit requirements** - Track access to sensitive materials (future)

Cultural sensitivity is not an afterthought - it's the **primary architectural driver** for major system design decisions.

---

## Public-facing and institutional commitments

The public site and home page may show **funder acknowledgment** (for example, National Endowment for the Humanities), an **accessibility** commitment (for example, WCAG 2.1 Level AA as an institutional target), and **contact** for accessibility or other support. Implementation is in the React **footer and layout**; see `02-PATTERNS/frontend.md` (Footer, favicon) for file locations and patterns.

**Do not remove or change** that messaging without **explicit product** sign-off and, where applicable, **grants or compliance** review, because it supports transparency and obligations alongside the cultural mission described above.

---

**See also**:
- `infrastructure.md` - How dual-server architecture implements cultural protection
- `security.md` - Permission groups and access control
- `data-models.md` - Access level field, anonymous field
