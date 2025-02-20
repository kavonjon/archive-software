from rest_framework.versioning import URLPathVersioning

class ArchiveAPIVersioning(URLPathVersioning):
    default_version = 'beta.v1'
    allowed_versions = ['beta.v1', 'v1']
    version_param = 'version'