from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router for the internal API
router = DefaultRouter()
router.register(r'items', views.ItemViewSet)
router.register(r'collections', views.CollectionViewSet)
router.register(r'collaborators', views.CollaboratorViewSet)
router.register(r'languoids', views.LanguoidViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
