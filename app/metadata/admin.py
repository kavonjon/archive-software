from django.contrib import admin
# from video_encoding.admin import FormatInline  # Removed for Django 5.0 compatibility

from .models import Languoid, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Item, ItemTitle, Columns_export, Document, Collection  # Video removed for Django 5.0 compatibility

admin.site.register(Languoid)
admin.site.register(Dialect)
admin.site.register(DialectInstance)
admin.site.register(Collaborator)
admin.site.register(CollaboratorRole)
admin.site.register(Geographic)

class ItemTitleInline(admin.TabularInline):
    model = ItemTitle
    extra = 1
    fields = ['title', 'language', 'default']

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    inlines = [ItemTitleInline]
    # readonly_fields = ['uuid']

admin.site.register(Columns_export)
admin.site.register(Document)
admin.site.register(Collection)

# @admin.register(Video)
# class VideoAdmin(admin.ModelAdmin):
#    inlines = (FormatInline,)
#
#    list_dispaly = ('get_filename', 'width', 'height', 'duration')
#    fields = ('file', 'width', 'height', 'duration')
#    readonly_fields = fields
# VideoAdmin temporarily disabled for Django 5.0 upgrade
