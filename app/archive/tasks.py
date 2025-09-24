import os
import subprocess
from datetime import datetime
from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task
def backup_database():
    """
    Create a daily PostgreSQL database backup and save to /app/backup/dumps/
    """
    try:
        # Ensure backup directory exists
        backup_dir = '/app/backup/dumps'
        os.makedirs(backup_dir, exist_ok=True)
        
        # Generate timestamp for backup filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'archive_backup_{timestamp}.sql'
        backup_path = os.path.join(backup_dir, backup_filename)
        
        # Database connection details from environment
        db_name = os.environ.get('DBNAME', 'postgres')
        db_user = os.environ.get('DBUSER', 'postgres')
        db_password = os.environ.get('DBPASS', 'hello')
        db_host = os.environ.get('DBHOST', 'db')
        db_port = os.environ.get('DBPORT', '5432')
        
        logger.info(f"Starting database backup to: {backup_path}")
        
        # Set PGPASSWORD environment variable for pg_dump
        env = os.environ.copy()
        env['PGPASSWORD'] = db_password
        
        # Run pg_dump command
        cmd = [
            'pg_dump',
            '-h', db_host,
            '-p', db_port,
            '-U', db_user,
            '-d', db_name,
            '--no-password',
            '--verbose',
            '--clean',
            '--if-exists',
            '--create',
            '-f', backup_path
        ]
        
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout
        )
        
        if result.returncode == 0:
            # Get file size for logging
            file_size = os.path.getsize(backup_path)
            logger.info(f"Database backup completed successfully: {backup_path} ({file_size} bytes)")
            
            # Clean up old backups with tiered retention
            cleanup_tiered_backups(backup_dir)
            
            return {
                'success': True,
                'backup_file': backup_filename,
                'backup_path': backup_path,
                'file_size': file_size
            }
        else:
            logger.error(f"Database backup failed: {result.stderr}")
            return {
                'success': False,
                'error': result.stderr
            }
            
    except subprocess.TimeoutExpired:
        logger.error("Database backup timed out after 1 hour")
        return {
            'success': False,
            'error': 'Backup timed out'
        }
    except Exception as e:
        logger.error(f"Database backup error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def cleanup_tiered_backups(backup_dir):
    """
    Tiered backup retention:
    - Keep daily backups for last 30 days
    - Keep Sunday backups for last 6 months  
    - Keep 1st of month backups for last 2 years
    """
    try:
        import time
        from datetime import datetime, timedelta
        
        now = datetime.now()
        
        # Define retention periods
        daily_cutoff = now - timedelta(days=30)
        weekly_cutoff = now - timedelta(days=180)  # 6 months
        monthly_cutoff = now - timedelta(days=730)  # 2 years
        
        backups_to_keep = set()
        backups_to_remove = []
        
        for filename in os.listdir(backup_dir):
            if not (filename.startswith('archive_backup_') and filename.endswith('.sql')):
                continue
                
            file_path = os.path.join(backup_dir, filename)
            
            # Extract timestamp from filename: archive_backup_YYYYMMDD_HHMMSS.sql
            try:
                timestamp_str = filename.replace('archive_backup_', '').replace('.sql', '')
                file_date = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
            except ValueError:
                logger.warning(f"Could not parse date from filename: {filename}")
                continue
            
            keep_file = False
            reason = ""
            
            # Rule 1: Keep all backups from last 30 days
            if file_date >= daily_cutoff:
                keep_file = True
                reason = "daily retention (last 30 days)"
            
            # Rule 2: Keep Wednesday backups from last 6 months
            elif file_date >= weekly_cutoff and file_date.weekday() == 2:  # Wednesday = 2
                keep_file = True
                reason = "weekly retention (Wednesday backup)"
            
            # Rule 3: Keep 1st of month backups from last 2 years
            elif file_date >= monthly_cutoff and file_date.day == 1:
                keep_file = True
                reason = "monthly retention (1st of month backup)"
            
            if keep_file:
                backups_to_keep.add(filename)
                logger.debug(f"Keeping {filename}: {reason}")
            else:
                backups_to_remove.append((filename, file_path))
        
        # Remove old backups
        for filename, file_path in backups_to_remove:
            try:
                os.remove(file_path)
                logger.info(f"Removed old backup: {filename}")
            except Exception as e:
                logger.warning(f"Failed to remove backup {filename}: {str(e)}")
        
        logger.info(f"Backup cleanup completed: {len(backups_to_keep)} kept, {len(backups_to_remove)} removed")
                    
    except Exception as e:
        logger.warning(f"Error during tiered backup cleanup: {str(e)}")
