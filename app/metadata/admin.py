from django.contrib import admin
from video_encoding.admin import FormatInline

from .models import Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, CollaboratorName, Geographic, Item, Columns_export, Document, Video

admin.site.register(Language)
admin.site.register(Dialect)
admin.site.register(DialectInstance)
admin.site.register(Collaborator)
admin.site.register(CollaboratorRole)
admin.site.register(CollaboratorName)
admin.site.register(Geographic)
admin.site.register(Item)
admin.site.register(Columns_export)
admin.site.register(Document)

@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
   inlines = (FormatInline,)

   list_dispaly = ('get_filename', 'width', 'height', 'duration')
   fields = ('file', 'width', 'height', 'duration')
   readonly_fields = fields
