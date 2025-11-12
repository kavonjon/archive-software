from django.shortcuts import render
from django.http import HttpResponse, HttpResponseNotFound
from django.views.generic import TemplateView
from django.conf import settings
import os

class ReactAppView(TemplateView):
    """
    Serve the React SPA for all frontend routes.
    This view serves the React index.html file for all routes that should be handled by React Router.
    
    IMPORTANT: This view should NEVER be reached for backend routes like /admin/, /api/, etc.
    Those should be caught by Django URL patterns before this view.
    """
    
    def get(self, request, *args, **kwargs):
        # Safety check: If somehow we're being called for a backend path, return 404
        # This should never happen if URL patterns are correct, but it's a safety net
        path = request.path
        backend_prefixes = [
            '/admin/', '/api/', '/django/', '/accounts/', '/select2/', 
            '/o/', '/auth/', '/metadata/', '/celery-health/', '/media/', '/static/'
        ]
        
        # Special case for collaborator export routes
        if path.startswith('/collaborators/'):
            export_suffixes = ['export-', 'download-', 'cleanup-']
            for suffix in export_suffixes:
                if suffix in path:
                    # This is a backend export route, not React
                    return HttpResponseNotFound('Path should not be handled by React')
        
        # Check if this is a backend path
        for prefix in backend_prefixes:
            if path.startswith(prefix):
                # This should never happen if URL routing is correct
                return HttpResponseNotFound('Path should not be handled by React')
        
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
