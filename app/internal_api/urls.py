"""
URL configuration for internal API used by React frontend
"""
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from .views import (
    InternalItemViewSet, 
    InternalCollectionViewSet, 
    InternalCollaboratorViewSet, 
    InternalLanguoidViewSet, 
    InternalItemTitleViewSet,
    item_genre_choices,
    item_language_description_type_choices,
    collaborator_role_choices,
    item_collaborator_roles
)

router = DefaultRouter()
router.register(r'items', InternalItemViewSet, basename='internal-items')
router.register(r'collections', InternalCollectionViewSet, basename='internal-collections')
router.register(r'collaborators', InternalCollaboratorViewSet, basename='internal-collaborators')
router.register(r'languoids', InternalLanguoidViewSet, basename='internal-languoids')

# Nested routing for item titles
title_list = InternalItemTitleViewSet.as_view({
    'get': 'list',
    'post': 'create'
})

title_detail = InternalItemTitleViewSet.as_view({
    'get': 'retrieve',
    'patch': 'partial_update',
    'put': 'update',
    'delete': 'destroy'
})

title_set_default = InternalItemTitleViewSet.as_view({
    'post': 'set_default'
})

urlpatterns = [
    path('v1/', include(router.urls)),
    # Genre choices endpoint
    path('v1/item-genre-choices/', item_genre_choices, name='item-genre-choices'),
    # Language description type choices endpoint
    path('v1/item-language-description-type-choices/', item_language_description_type_choices, name='item-language-description-type-choices'),
    # Collaborator role choices endpoint
    path('v1/collaborator-role-choices/', collaborator_role_choices, name='collaborator-role-choices'),
    # Item collaborator roles endpoint (for editing collaborators + roles on items)
    path('v1/items/<int:item_id>/collaborator-roles/', item_collaborator_roles, name='item-collaborator-roles'),
    # Nested title routes
    re_path(r'^v1/items/(?P<item_pk>\d+)/titles/$', title_list, name='item-titles-list'),
    re_path(r'^v1/items/(?P<item_pk>\d+)/titles/(?P<pk>\d+)/$', title_detail, name='item-titles-detail'),
    re_path(r'^v1/items/(?P<item_pk>\d+)/titles/(?P<pk>\d+)/set_default/$', title_set_default, name='item-titles-set-default'),
]