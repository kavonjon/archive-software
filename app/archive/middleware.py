class ScriptNameMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.META['SCRIPT_NAME'] = '/dj'
        return self.get_response(request)