from django.urls import path
from . import views

urlpatterns = [
    path('deposits/<int:deposit_id>/', views.deposit_detail, name='deposit_detail'),
    path('deposits/', views.deposit_list, name='deposit_list'),
    path('deposits/create/', views.deposit_create, name='deposit_create'),
    path('deposits/<int:deposit_id>/edit/', views.deposit_edit, name='deposit_edit'),
    path('deposits/<int:deposit_id>/files/', views.deposit_files, name='deposit_files'),
    path('api/deposits/<int:deposit_id>/files/upload/', views.upload_files, name='upload_files'),
    # Other URL patterns...
] 