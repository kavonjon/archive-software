from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .v1.views import items, collections, languoids

# Create separate routers for beta and stable
beta_router = DefaultRouter()
stable_router = DefaultRouter()

# Register viewsets
beta_router.register(r'items', items.ItemViewSet, basename='beta-item')
beta_router.register(r'collections', collections.CollectionViewSet, basename='beta-collection')
beta_router.register(r'languoids', languoids.LanguoidViewSet, basename='beta-languoid')

stable_router.register(r'items', items.ItemViewSet, basename='item')
stable_router.register(r'collections', collections.CollectionViewSet, basename='collection')
stable_router.register(r'languoids', languoids.LanguoidViewSet, basename='languoid')

urlpatterns = [
    # API endpoints
    path('beta/v1/', include(beta_router.urls)),
    path('v1/', include(stable_router.urls)),
]