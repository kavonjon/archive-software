from django.shortcuts import render
from django.http import HttpResponse
from django.views.generic import TemplateView
from django.conf import settings
import os

class ReactAppView(TemplateView):
    """
    Serve the React SPA for all frontend routes.
    This view serves the React index.html file for all routes that should be handled by React Router.
    """
    
    def get(self, request, *args, **kwargs):
        try:
            # Path to the React build index.html file in static-files (source directory)
            index_path = os.path.join(settings.BASE_DIR, 'static-files', 'frontend', 'index.html')
            
            # If not found in static-files, try STATIC_ROOT (for production after collectstatic)
            if not os.path.exists(index_path) and settings.STATIC_ROOT:
                index_path = os.path.join(settings.STATIC_ROOT, 'frontend', 'index.html')
            
            with open(index_path, 'r', encoding='utf-8') as f:
                return HttpResponse(f.read(), content_type='text/html')
                
        except FileNotFoundError:
            # Fallback if React build files don't exist
            return HttpResponse(
                '<h1>React App Not Built</h1>'
                '<p>Please run <code>npm run build:django</code> in the frontend directory.</p>',
                content_type='text/html',
                status=503
            )
