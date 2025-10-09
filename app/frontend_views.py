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
            # Path to the React build index.html file
            index_path = os.path.join(settings.STATIC_ROOT or settings.BASE_DIR, 'static', 'frontend', 'index.html')
            
            # If STATIC_ROOT doesn't exist (development), try the app static directory
            if not os.path.exists(index_path):
                index_path = os.path.join(settings.BASE_DIR, 'static', 'frontend', 'index.html')
            
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
