from django.urls import path
from . import views

urlpatterns = [
    # Add these paths to urlpatterns
    path('items/<int:item_id>/files/', views.item_files, name='item_files'),
    path('api/items/<int:item_id>/files/', views.api_update_item_files, name='api_update_item_files'),
] 