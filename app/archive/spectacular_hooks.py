"""
drf-spectacular preprocessing hooks for schema generation
"""

def exclude_internal_api(endpoints):
    """
    Exclude internal API endpoints from the public API schema.
    
    The internal API (/internal/*) is used exclusively by the React frontend
    and should not be documented in the public API documentation.
    
    Args:
        endpoints: List of (path, path_regex, method, callback) tuples
        
    Returns:
        Filtered list of endpoints excluding internal API routes
    """
    filtered = []
    
    for path, path_regex, method, callback in endpoints:
        # Exclude any endpoint starting with /internal/
        if not path.startswith('/internal/'):
            filtered.append((path, path_regex, method, callback))
    
    return filtered

