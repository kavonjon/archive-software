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
from django.urls import path, include
from django.views.generic import TemplateView
from metadata.views import item_index, item_migrate_list, item_detail, item_edit, item_add, item_delete,language_index, language_detail, language_edit, language_add, language_delete, language_stats, dialect_edit, dialect_add, dialect_delete, dialect_instance_edit, collaborator_index, collaborator_detail, collaborator_edit, collaborator_add, collaborator_delete, collaborator_role_edit, geographic_add, geographic_edit, geographic_delete, columns_export_index, columns_export_detail, columns_export_edit, columns_export_add, ImportView, document_upload, document_index, document_detail, document_edit, document_add, document_delete, ItemUpdateMigrateView, custom_error_500, trigger_error

handler500 = custom_error_500

urlpatterns = [
    path('trigger-error/', trigger_error),
    path('admin/', admin.site.urls),
    path('accounts/', include('django.contrib.auth.urls')),
    path("", TemplateView.as_view(template_name='home.html')),
    path("no-permission", TemplateView.as_view(template_name='no_permission.html')),
    path("catalog/", item_index, name="item_index"),
    path("catalog/<int:pk>/", item_detail, name="item_detail"),
    path("catalog/<int:pk>/edit/", item_edit, name="item_edit"),
    path("catalog/add/", item_add.as_view(), name="item_add"),
    path('catalog/<int:pk>/delete/', item_delete.as_view(), name='item_delete'),
    path("catalog/<int:parent_pk>/geographic/add/", geographic_add.as_view(), name="geographic_add"),
    path("migrate/", item_index, name="migrate"),
    path("migrate/list/", item_migrate_list, name="migrate_list"),
    path("api/item-update-migrate/<int:pk>/", ItemUpdateMigrateView.as_view(), name="item_update_migrate"),
    path("documents/", document_index, name="document_index"),
    path("documents/<int:pk>/", document_detail, name="document_detail"),
    path("documents/<int:pk>/edit/", document_edit, name="document_edit"),
    path("documents/add/", document_add.as_view(), name="document_add"),
    path('documents/<int:pk>/delete/', document_delete.as_view(), name='document_delete'),
    path("documents/<int:parent_pk>/geographic/add/", geographic_add.as_view(), name="geographic_add"),
    path("languages/", language_index, name="language_index"),
    path("languages/<int:pk>/", language_detail, name="language_detail"),
    path("languages/<int:pk>/edit/", language_edit, name="language_edit"),
    path("languages/add/", language_add.as_view(), name="languages_add"),
    path('languages/<int:pk>/delete/', language_delete.as_view(), name='language_delete'),
    path('languages/stats/', language_stats, name='language_stats'),
    path("dialect-instances/<int:pk>/edit/", dialect_instance_edit, name="dialect_instance_edit"),
    path("dialects/<int:pk>/edit/", dialect_edit, name="dialect_edit"),
    path("languages/<int:lang_pk>/dialects/add/", dialect_add.as_view(), name="dialect_add"),
    path('dialects/<int:pk>/delete/', dialect_delete.as_view(), name='dialect_delete'),
    path("collaborators/", collaborator_index, name="collaborator_index"),
    path("collaborators/<int:pk>/", collaborator_detail, name="collaborator_detail"),
    path("collaborators/<int:pk>/edit/", collaborator_edit, name="collaborator_edit"),
    path("collaborators/add/", collaborator_add.as_view(), name="collaborator_add"),
    path('collaborators/<int:pk>/delete/', collaborator_delete.as_view(), name='collaborator_delete'),
    path("geographic/<int:pk>/edit/", geographic_edit, name="geographic_edit"),
    path('geographic/<int:pk>/delete/', geographic_delete.as_view(), name='geographic_delete'),

    path("roles/<int:pk>/edit/", collaborator_role_edit, name="collaborator_role_edit"),
    path("export-columns/", columns_export_index, name="columns_export_index"),
    path("export-columns/<int:pk>/", columns_export_detail, name="columns_export_detail"),
    path("export-columns/<int:pk>/edit/", columns_export_edit, name="columns_export_edit"),
    path("export-columns/add/", columns_export_add.as_view(), name="columns_export_add"),

    path('search/', item_index, name='item_all_filters'),
    path('catalog/import/', ImportView, name='import'),
    path('documents/import/', document_upload.as_view(), name='document_upload'),
    path('collaborators/import/', ImportView, name='import_collaborator'),
    path('languages/import/', ImportView, name='import_language'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
