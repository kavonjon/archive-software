from django.urls import path, include

urlpatterns = [
    path('v1/', include('internal_api.v1.urls')),
]
