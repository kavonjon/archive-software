from django.core.management.base import BaseCommand
from django.conf import settings
from deposits.models import Deposit
from deposits.metadata import MetadataProcessor
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Cleans up old metadata JSON files for all deposits'
    
    def handle(self, *args, **options):
        self.stdout.write('Starting metadata file cleanup...')
        
        # Get all deposits
        deposits = Deposit.objects.all()
        count = 0
        
        for deposit in deposits:
            try:
                processor = MetadataProcessor(deposit)
                processor.cleanup_old_metadata_files()
                count += 1
            except Exception as e:
                logger.error(f"Error cleaning up files for deposit {deposit.id}: {str(e)}")
        
        self.stdout.write(self.style.SUCCESS(f'Successfully cleaned up metadata files for {count} deposits')) 