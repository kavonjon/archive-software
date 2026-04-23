# Security & Permissions

## Group-Based Access Control

### Four User Roles

**Administrator** (Django Superuser):
- Description: Django superusers with full system access
- `is_staff`: Yes
- `is_superuser`: Yes
- Groups: None required (superuser status grants all access)
- Django admin access: Yes
- API view access: Yes
- API edit access: Yes
- API delete access: Yes
- Security level: Highest

**Archivist** (Full Access):
- Description: Technical staff with Django admin access and full data operations including delete
- `is_staff`: Yes
- `is_superuser`: No
- Groups: **REQUIRED** - Must be in "Archivist" group
- Django admin access: Yes
- API view access: Yes
- API edit access: Yes
- API delete access: Yes
- Security level: High
- Typical users: Senior archivists, technical archivists

**Museum Staff** (Edit Access):
- Description: Operational staff with full editing via React app but no Django admin access or delete permissions
- `is_staff`: No
- `is_superuser`: No
- Groups: **REQUIRED** - Must be in "Museum Staff" group
- Django admin access: No
- API view access: Yes
- API edit access: Yes
- API delete access: No
- Security level: Medium
- Typical users: Curators, collection managers, research assistants, student workers
- Rationale: Prevents accidental backend database modifications and destructive operations while maintaining full operational capabilities

**Read-Only** (View Access):
- Description: View access to all data without modification rights
- `is_staff`: No
- `is_superuser`: No
- Groups: **REQUIRED** - Must be in "Read-Only" group
- Django admin access: No
- API view access: Yes
- API edit access: No
- API delete access: No
- Security level: Low
- Typical users: Researchers, interns, temporary staff

### No Group = Access Denied

**Critical Rule**: Authenticated users WITHOUT group assignment receive **403 Forbidden**

**Error Message**: "Your account is not assigned to a user group. Please contact an administrator for access."

**Rationale**: Explicit group assignment required - no accidental access

**Behavior**: Authenticated users WITHOUT any group assignment are DENIED all access to system

## Permission Implementation

### Implementation Method

**Method**: Django Groups with custom DRF permission class (`IsAuthenticatedWithEditAccess`)

**View Access Logic**: `is_staff` or `is_superuser` OR user in "Archivist", "Museum Staff", or "Read-Only" group

**Edit Access Logic**: `is_staff` or `is_superuser` OR user in "Archivist" or "Museum Staff" group

**Delete Access Logic**: `is_superuser` OR user in "Archivist" group

**No Group Behavior**: Authenticated users WITHOUT group assignment are DENIED all access

**Admin Separation**: `is_staff=False` prevents Django admin access while group membership allows React app access

### Backend (DRF Custom Permission Class)

**Class**: `IsAuthenticatedWithEditAccess` in `app/internal_api/views.py`

**Permission Class File**: `app/internal_api/permissions.py`

**Logic**:
```python
def has_permission(self, request, view):
    # Must be authenticated
    if not request.user.is_authenticated:
        return False
    
    # View access: Staff/superuser OR in any group
    if request.method in SAFE_METHODS:
        return (request.user.is_staff or 
                request.user.groups.filter(
                    name__in=['Archivist', 'Museum Staff', 'Read-Only']
                ).exists())
    
    # Edit access: Staff/superuser OR Archivist/Museum Staff
    return (request.user.is_staff or 
            request.user.groups.filter(
                name__in=['Archivist', 'Museum Staff']
            ).exists())

def has_object_permission(self, request, view, obj):
    # Delete: Superuser OR Archivist only
    if request.method == 'DELETE':
        return (request.user.is_superuser or 
                request.user.groups.filter(name='Archivist').exists())
    
    return self.has_permission(request, view)
```

**Applied To**: All internal API ViewSets (Items, Collaborators, Languoids, Collections, Documents)

### Frontend (Conditional UI)

**Frontend Implementation**:
- `hasViewAccess`: Checks `is_staff`/`is_superuser` OR group membership in ["Archivist", "Museum Staff", "Read-Only"]
- `hasEditAccess`: Checks `is_staff`/`is_superuser` OR group membership in ["Archivist", "Museum Staff"]
- `hasDeleteAccess`: Checks `is_superuser` OR group membership in ["Archivist"]

**Permission Utilities** (`utils/permissions.ts`):
```typescript
hasViewAccess(user): boolean
hasEditAccess(user): boolean  
hasDeleteAccess(user): boolean
```

**UI Adaptation**:
- **Read-Only users**: See all data, no edit/create/delete buttons
- **Museum Staff users**: See all data + edit/create buttons, NO delete buttons
- **Archivist users**: See all buttons and controls
- **No group users**: Error message displayed

**Examples**:
```typescript
{hasEditAccess(user) && (
  <IconButton onClick={handleEdit}>
    <EditIcon />
  </IconButton>
)}

{hasDeleteAccess(user) && (
  <Button onClick={handleDelete}>Delete</Button>
)}
```

## User Roles Summary

| Role | is_staff | is_superuser | Groups | API Access | Django Admin | Delete |
|------|----------|--------------|--------|------------|--------------|--------|
| **Administrator** | Yes | Yes | (none) | Full | Yes | Yes |
| **Archivist** | Yes | - | Archivist | Full | Yes | Yes |
| **Museum Staff** | - | - | Museum Staff | Edit | - | - |
| **Read-Only** | - | - | Read-Only | View | - | - |
| **No Group** | - | - | (none) | **DENIED** | - | - |

## Authentication

### Session-Based Auth

**Flow**:
1. User logs in via `/auth/login/`
2. Django creates session cookie
3. Frontend includes cookie in all requests (`credentials: 'include'`)
4. Backend validates session

**CSRF Protection**:
- Frontend fetches CSRF token from `/auth/csrf/`
- Includes `X-CSRFToken` header in non-GET requests
- CORS configured for localhost:3000 <> localhost:8000

**Settings** (`app/archive/settings.py`):
```python
CORS_ALLOWED_ORIGINS = ['http://localhost:3000']
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_HEADERS = True              # Development flexibility
CORS_EXPOSE_HEADERS = ['content-type', 'x-csrftoken']
CSRF_TRUSTED_ORIGINS = ['http://localhost:3000']
CSRF_COOKIE_SAMESITE = 'Lax'              # Allow cross-origin requests
CSRF_COOKIE_SECURE = False                 # Set True for HTTPS in production
```

**Common errors and fixes**:
- `CSRF origin checking failed`: Add frontend origin to `CSRF_TRUSTED_ORIGINS`
- `CSRF token missing`: Ensure `X-CSRFToken` header is included in all POST/PATCH/PUT/DELETE requests
- `Credentials not included`: Set `credentials: 'include'` in all fetch requests

## Group Management

### Management Command

**List all users with groups**:
```bash
python manage.py manage_user_roles --list-users
```

**Add user to group**:
```bash
python manage.py manage_user_roles --add-to-group username 'Archivist'
python manage.py manage_user_roles --add-to-group username 'Museum Staff'
python manage.py manage_user_roles --add-to-group username 'Read-Only'
```

**Remove from group**:
```bash
python manage.py manage_user_roles --remove-from-group username 'Museum Staff'
```

**Set staff status**:
```bash
python manage.py manage_user_roles --set-staff username --staff
python manage.py manage_user_roles --set-staff username --no-staff
```

### Django Admin

Administrators and Archivists can manage groups via:
- `/admin/auth/group/` - Group management
- `/admin/auth/user/` - User group assignments

## API Behavior

### HTTP Status Codes

**401 Unauthorized**: User not authenticated (not logged in)

**403 Forbidden**: 
- User authenticated but not in any group
- User in Read-Only group attempting edit/delete
- Museum Staff user attempting delete

**200 OK**: Request successful, user has permission

**400 Bad Request**: Invalid data (separate from permissions)

### Request Examples

**GET request** (Read-Only user):
```
GET /internal/v1/items/123/
Response: 200 OK (has view access)
```

**PATCH request** (Read-Only user):
```
PATCH /internal/v1/items/123/
Response: 403 Forbidden (lacks edit access)
```

**DELETE request** (Museum Staff user):
```
DELETE /internal/v1/items/123/
Response: 403 Forbidden (lacks delete access)
```

**DELETE request** (Archivist user):
```
DELETE /internal/v1/items/123/
Response: 204 No Content (has delete access)
```

## Security Best Practices

### What We Do
- Explicit group assignment (no default access)
- Three-tier permissions (view/edit/delete separation)
- CSRF protection for state-changing requests
- CORS allowlist (no wildcards)
- Session-based auth (no token exposure in localStorage)
- Separate Django admin from React API access

### Security Benefits

**Group-Based Permission System**:
- Explicit group assignment required - no accidental access
- Clear separation between operational and administrative interfaces
- Reduced risk of accidental backend modifications
- Three-tier access model (view/edit/delete) provides granular control
- Future administrators easily understand system requires group assignment
- Read-Only group provides safe access for researchers and temporary staff
- Museum Staff can edit but not delete, preventing destructive accidents

### What We Don't Have (Future Considerations)
- Field-level permissions (all-or-nothing per model)
- Row-level permissions (can't restrict to own records)
- API rate limiting
- Audit logging (who changed what when)

## Common Patterns

### Frontend Permission Check
```typescript
// In component
const { user } = useAuth();

if (!hasViewAccess(user)) {
  return <ErrorPage message="Access denied" />;
}

return (
  <>
    {/* Always visible */}
    <DataTable data={items} />
    
    {/* Conditional on permission */}
    {hasEditAccess(user) && (
      <Button onClick={handleCreate}>Add New</Button>
    )}
    
    {hasDeleteAccess(user) && (
      <IconButton onClick={handleDelete}>
        <DeleteIcon />
      </IconButton>
    )}
  </>
);
```

### Backend ViewSet
```python
class InternalItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedWithEditAccess]
    queryset = Item.objects.all()
    serializer_class = InternalItemSerializer
    
    # Permission class handles all checks automatically
    # No per-action permission override needed
```

## Testing Permissions

### Create Test Users

```python
# Django shell
from django.contrib.auth.models import User, Group

# Create groups (if not exist)
archivist_group = Group.objects.get_or_create(name='Archivist')[0]
staff_group = Group.objects.get_or_create(name='Museum Staff')[0]
readonly_group = Group.objects.get_or_create(name='Read-Only')[0]

# Create test users
archivist = User.objects.create_user('archivist_test', 'test@example.com', 'password')
archivist.is_staff = True
archivist.groups.add(archivist_group)
archivist.save()

museum_staff = User.objects.create_user('staff_test', 'test@example.com', 'password')
museum_staff.groups.add(staff_group)
museum_staff.save()

readonly = User.objects.create_user('readonly_test', 'test@example.com', 'password')
readonly.groups.add(readonly_group)
readonly.save()
```

### Test Checklist

**For each user type**:
- [ ] Can log in successfully
- [ ] Sees appropriate UI elements (no edit buttons for read-only)
- [ ] GET requests succeed (has view access)
- [ ] POST/PATCH requests: Success for edit users, 403 for read-only
- [ ] DELETE requests: Success for archivist, 403 for museum staff/read-only
- [ ] Django admin: Access for archivist, denied for museum staff/read-only

**For no-group user**:
- [ ] Sees "not assigned to user group" error message
- [ ] All API requests return 403 Forbidden
- [ ] Django admin access denied

---

**See also**:
- `infrastructure.md` - Dual-server deployment architecture
- `../02-PATTERNS/backend.md` - DRF permission patterns
