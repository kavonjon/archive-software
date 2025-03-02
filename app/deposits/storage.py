import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage

class DepositStorage(FileSystemStorage):
    """
    Storage backend for deposit files.
    
    Files are stored in a dedicated deposit volume separate from the main repository.
    """
    def __init__(self, *args, **kwargs):
        # Get deposit volume path from settings, or default to a subdirectory of MEDIA_ROOT
        location = getattr(settings, 'DEPOSIT_VOLUME', 
                          os.path.join(settings.MEDIA_ROOT, 'deposits'))
        
        # Ensure the directory exists
        os.makedirs(location, exist_ok=True)
        
        # Initialize with custom location
        kwargs['location'] = location
        super().__init__(*args, **kwargs)
    
    def get_available_name(self, name, max_length=None):
        """
        Returns a filename that's free on the target storage system.
        
        For deposits, we want to keep the original filename if possible,
        but add a suffix if needed to avoid collisions.
        """
        # Get directory name and filename
        dir_name, file_name = os.path.split(name)
        file_root, file_ext = os.path.splitext(file_name)
        
        # Try original name first
        count = 0
        while self.exists(name):
            # If file exists, add a counter suffix
            count += 1
            name = os.path.join(dir_name, f"{file_root}_{count}{file_ext}")
            
        return name 