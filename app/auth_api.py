"""
Authentication API endpoints for React frontend.
Provides session-based authentication using Django's built-in auth system.
"""
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View
import json


class CSRFTokenView(View):
    """
    Provide CSRF token for React frontend.
    """
    def get(self, request):
        token = get_token(request)
        return JsonResponse({'csrfToken': token})


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(View):
    """
    Handle user login via session authentication.
    """
    def post(self, request):
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            if not username or not password:
                return JsonResponse({
                    'success': False,
                    'error': 'Username and password are required'
                }, status=400)
            
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                if user.is_active:
                    login(request, user)
                    return JsonResponse({
                        'success': True,
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'email': user.email,
                            'first_name': user.first_name,
                            'last_name': user.last_name,
                            'is_staff': user.is_staff,
                            'is_superuser': user.is_superuser,
                        }
                    })
                else:
                    return JsonResponse({
                        'success': False,
                        'error': 'Account is disabled'
                    }, status=401)
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Invalid username or password'
                }, status=401)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON data'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': 'An error occurred during login'
            }, status=500)


class LogoutView(View):
    """
    Handle user logout.
    """
    def post(self, request):
        logout(request)
        return JsonResponse({'success': True})


class UserStatusView(View):
    """
    Check current user authentication status.
    """
    def get(self, request):
        if request.user.is_authenticated:
            return JsonResponse({
                'authenticated': True,
                'user': {
                    'id': request.user.id,
                    'username': request.user.username,
                    'email': request.user.email,
                    'first_name': request.user.first_name,
                    'last_name': request.user.last_name,
                    'is_staff': request.user.is_staff,
                    'is_superuser': request.user.is_superuser,
                }
            })
        else:
            return JsonResponse({
                'authenticated': False,
                'user': None
            })
