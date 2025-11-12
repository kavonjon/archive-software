from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .v1.views import items, collections, languoids, collaborators, map as map_views

# v1 router
router = DefaultRouter()

# Map router (separate namespace)
map_router = DefaultRouter()

# Register v1 viewsets
router.register(r'items', items.ItemViewSet, basename='item')
router.register(r'collections', collections.CollectionViewSet, basename='collection')
router.register(r'languoids', languoids.LanguoidViewSet, basename='languoid')
router.register(r'collaborators', collaborators.CollaboratorViewSet, basename='collaborator')

# Register map viewsets
map_router.register(r'items', map_views.ItemMapViewSet, basename='map-item')

urlpatterns = [
    # v1 API endpoints
    path('v1/', include(router.urls)),
    
    # Map endpoints (under v1 namespace)
    path('v1/map/', include(map_router.urls)),
]