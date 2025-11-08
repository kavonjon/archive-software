"""archive URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.conf import settings
from django.conf.urls import handler500
from django.conf.urls.static import static
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from metadata.views import collection_index, collection_detail, collection_add, collection_edit, collection_delete, item_index, item_migrate_list, item_detail, item_edit, item_add, item_delete,languoid_index, languoid_detail, languoid_edit, languoid_add, languoid_delete, languoid_stats, collaborator_index, collaborator_detail, collaborator_edit, collaborator_add, collaborator_delete, collaborator_role_edit, geographic_add, geographic_edit, geographic_delete, columns_export_index, columns_export_detail, columns_export_edit, columns_export_add, ImportView, document_upload, document_index, document_detail, document_edit, document_add, document_delete, ItemUpdateMigrateView, LanguoidListView, custom_error_500, custom_error_403, trigger_error, download_collaborator_export, collaborator_export_task_status, celery_health_check, cleanup_collaborator_export
from frontend_views import ReactAppView
from auth_api import CSRFTokenView, LoginView, LogoutView, UserStatusView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

handler500 = custom_error_500
handler403 = custom_error_403

urlpatterns = [
    # =============================================================================
    # CRITICAL BACKEND ROUTES (Must stay at top - these should NOT go to React)
    # =============================================================================
    
    # Django Admin (PRODUCTION CRITICAL)
    path('admin/', admin.site.urls),
    
    # Authentication & Accounts
    path('accounts/', include('django.contrib.auth.urls')),
    
    # Django Select2
    path("select2/", include("django_select2.urls")),
    
    # Error pages
    path('trigger-error/', trigger_error),
    path("no-permission", TemplateView.as_view(template_name='no_permission.html')),
    
    # =============================================================================
    # API ROUTES (Must stay before React catch-all)
    # =============================================================================

    # API Schema and Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # OAuth2
    path('o/', include('oauth2_provider.urls', namespace='oauth2_provider')),

    # Public API
    path('api/', include('api.urls')),
    
    # Internal API for React frontend
    path('internal/', include('internal_api.urls')),

    # Authentication API for React frontend
    path('auth/csrf/', CSRFTokenView.as_view(), name='csrf_token'),
    path('auth/login/', LoginView.as_view(), name='api_login'),
    path('auth/logout/', LogoutView.as_view(), name='api_logout'),
    path('auth/status/', UserStatusView.as_view(), name='user_status'),

    # Metadata API
    path('metadata/', include('metadata.urls')),
    
    # Legacy API routes
    path("api/item-update-migrate/<int:pk>/", ItemUpdateMigrateView.as_view(), name="item_update_migrate"),
    path("api/languoids/", LanguoidListView.as_view(), name="languoids_list"),
    
    # =============================================================================
    # SPECIAL BACKEND ROUTES (Export, Health Checks)
    # =============================================================================
    
    # Health checks
    path('celery-health/', celery_health_check, name='celery_health_check'),
    
    # Export routes (API endpoints - not templates)
    path('collaborators/export-task-status/<str:task_id>/', collaborator_export_task_status, name='collaborator_export_task_status'),
    path('collaborators/download-export/<str:filename>/', download_collaborator_export, name='collaborator_download_export'),
    path('collaborators/cleanup-export/<str:filename>/', cleanup_collaborator_export, name='collaborator_cleanup_export'),
    
    # =============================================================================
    # DJANGO TEMPLATE ROUTES (Accessible at /django/* for developers)
    # =============================================================================
    
    path("django/", TemplateView.as_view(template_name='home.html'), name="django_home"),
    
    # List views
    path("django/items/", item_index, name="django_item_index"),
    path("django/collections/", collection_index, name="django_collection_index"),
    path("django/collaborators/", collaborator_index, name="django_collaborator_index"),
    path("django/languoids/", languoid_index, name="django_languoid_index"),
    path("django/documents/", document_index, name="django_document_index"),
    
    # Item (Catalog) detail/edit routes
    path("django/catalog/<int:pk>/", item_detail, name="django_item_detail"),
    path("django/catalog/<int:pk>/edit/", item_edit, name="django_item_edit"),
    path("django/catalog/add/", item_add.as_view(), name="django_item_add"),
    path('django/catalog/<int:pk>/delete/', item_delete.as_view(), name='django_item_delete'),
    path("django/catalog/<int:parent_pk>/geographic/add/", geographic_add.as_view(), name="django_geographic_add_item"),
    
    # Collection detail/edit routes
    path("django/collections/<int:pk>/", collection_detail, name="django_collection_detail"),
    path("django/collections/<int:pk>/edit/", collection_edit, name="django_collection_edit"),
    path("django/collections/add/", collection_add.as_view(), name="django_collection_add"),
    path("django/collections/<int:pk>/delete/", collection_delete.as_view(), name="django_collection_delete"),
    
    # Collaborator detail/edit routes
    path("django/collaborators/<int:pk>/", collaborator_detail, name="django_collaborator_detail"),
    path("django/collaborators/<int:pk>/edit/", collaborator_edit, name="django_collaborator_edit"),
    path("django/collaborators/add/", collaborator_add.as_view(), name="django_collaborator_add"),
    path('django/collaborators/<int:pk>/delete/', collaborator_delete.as_view(), name='django_collaborator_delete'),
    
    # Languoid detail/edit routes
    path("django/languoids/<str:pk>/", languoid_detail, name="django_languoid_detail"),
    path("django/languoids/<str:pk>/edit/", languoid_edit, name="django_languoid_edit"),
    path("django/languoids/add/", languoid_add.as_view(), name="django_languoids_add"),
    path('django/languoids/<str:pk>/delete/', languoid_delete.as_view(), name='django_languoid_delete'),
    path('django/languoids/stats/', languoid_stats, name='django_languoid_stats'),
    
    # Document detail/edit routes
    path("django/documents/<int:pk>/", document_detail, name="django_document_detail"),
    path("django/documents/<int:pk>/edit/", document_edit, name="django_document_edit"),
    path("django/documents/add/", document_add.as_view(), name="django_document_add"),
    path('django/documents/<int:pk>/delete/', document_delete.as_view(), name='django_document_delete'),
    path("django/documents/<int:parent_pk>/geographic/add/", geographic_add.as_view(), name="django_geographic_add_document"),
    
    # Geographic routes
    path("django/geographic/<int:pk>/edit/", geographic_edit, name="django_geographic_edit"),
    path('django/geographic/<int:pk>/delete/', geographic_delete.as_view(), name='django_geographic_delete'),
    
    # Collaborator role routes
    path("django/roles/<int:pk>/edit/", collaborator_role_edit, name="django_collaborator_role_edit"),
    
    # Export columns routes
    path("django/export-columns/", columns_export_index, name="django_columns_export_index"),
    path("django/export-columns/<int:pk>/", columns_export_detail, name="django_columns_export_detail"),
    path("django/export-columns/<int:pk>/edit/", columns_export_edit, name="django_columns_export_edit"),
    path("django/export-columns/add/", columns_export_add.as_view(), name="django_columns_export_add"),
    
    # Migrate routes
    path("django/migrate/", item_index, name="django_migrate"),
    path("django/migrate/list/", item_migrate_list, name="django_migrate_list"),
    
    # Search route
    path('django/search/', item_index, name='django_item_all_filters'),
    
    # Import routes (Django template forms)
    path('django/catalog/import/', ImportView, name='django_import'),
    path('django/documents/import/', document_upload.as_view(), name='django_document_upload'),
    path('django/collaborators/import/', ImportView, name='django_import_collaborator'),
    path('django/languoids/import/', ImportView, name='django_import_language'),
    
    # =============================================================================
    # REACT SPA ROUTES (Catch-all - MUST BE LAST!)
    # =============================================================================
    
    # Root path serves React SPA
    path("", ReactAppView.as_view(), name='react_home'),
    
    # Catch-all route - serves React SPA for any unmatched URL
    # This allows React Router to handle all frontend routing
    # IMPORTANT: This must be the last route in the list!
    re_path(r'^.*$', ReactAppView.as_view(), name='react_catchall'),
]

#urlpatterns = path(r'dj/', include(urlpatterns)),  # prepend 'django/' to all URLs

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
