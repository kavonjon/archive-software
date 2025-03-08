from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import items, collections, languoids, deposits
from .views.uploads import DepositFileViewSet
from .views.notifications import NotificationViewSet
from .views.reports import ReportViewSet

router = DefaultRouter()

# Register v1 viewsets
router.register(r'items', items.ItemViewSet, basename='item')
router.register(r'collections', collections.CollectionViewSet, basename='collection')
router.register(r'languoids', languoids.LanguoidViewSet, basename='languoid')

# Register deposit-related viewsets
router.register(r'deposits', deposits.DepositViewSet)
router.register(r'uploads', DepositFileViewSet)
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'reports', ReportViewSet, basename='report')

urlpatterns = [
    path('', include(router.urls)),
] 