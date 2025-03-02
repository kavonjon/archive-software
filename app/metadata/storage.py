import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage

class RepositoryStorage(FileSystemStorage):
    """
    Storage backend for repository files.
    
    Files are stored in the main repository volume.
    """
    def __init__(self, *args, **kwargs):
        # Get repository volume path from settings, or default to a subdirectory of MEDIA_ROOT
        location = getattr(settings, 'REPOSITORY_VOLUME', 
                          os.path.join(settings.MEDIA_ROOT, 'repository'))
        
        # Ensure the directory exists
        os.makedirs(location, exist_ok=True)
        
        # Initialize with custom location
        kwargs['location'] = location
        super().__init__(*args, **kwargs) 