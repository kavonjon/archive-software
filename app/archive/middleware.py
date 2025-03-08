import logging

logger = logging.getLogger(__name__)

class RequestLoggerMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Log the request
        logger.debug(f"Request: {request.method} {request.path}")
        logger.debug(f"User: {request.user}")
        logger.debug(f"Headers: {request.headers}")
        
        # Process the request
        response = self.get_response(request)
        
        # Log the response
        logger.debug(f"Response: {response.status_code}")
        
        return response 