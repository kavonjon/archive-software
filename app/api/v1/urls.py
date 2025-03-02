from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.deposits import DepositViewSet
from .views.uploads import DepositFileViewSet

router = DefaultRouter()
# ... existing routes ...
router.register(r'deposits', DepositViewSet)
router.register(r'uploads', DepositFileViewSet)

urlpatterns = [
    # ... existing patterns ...
    path('', include(router.urls)),
] 