from django.contrib import admin
from video_encoding.admin import FormatInline

from .models import Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, CollaboratorName, Geographic, Item, ItemTitle, Columns_export, Document, Collection, Video

admin.site.register(Language)
admin.site.register(Dialect)
admin.site.register(DialectInstance)
admin.site.register(Collaborator)
admin.site.register(CollaboratorRole)
admin.site.register(CollaboratorName)
admin.site.register(Geographic)

class ItemTitleInline(admin.TabularInline):
    model = ItemTitle
    extra = 1
    fields = ['title', 'language', 'default']

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    inlines = [ItemTitleInline]

admin.site.register(Columns_export)
admin.site.register(Document)
admin.site.register(Collection)

@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
   inlines = (FormatInline,)

   list_dispaly = ('get_filename', 'width', 'height', 'duration')
   fields = ('file', 'width', 'height', 'duration')
   readonly_fields = fields
