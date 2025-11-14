from django.contrib import admin
# from video_encoding.admin import FormatInline  # Removed for Django 5.0 compatibility

from .models import Languoid, Collaborator, CollaboratorRole, Geographic, Item, ItemTitle, Columns_export, Document, Collection  # Video removed for Django 5.0 compatibility

admin.site.register(Languoid)
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
    readonly_fields = ['browse_categories_display']
    
    def browse_categories_display(self, obj):
        """Display browse categories as readable list"""
        if not obj.browse_categories:
            return "-"
        
        # Convert to list if it's a string (MultiSelectField can return either)
        if isinstance(obj.browse_categories, str):
            values = [v.strip() for v in obj.browse_categories.split(',') if v.strip()]
        else:
            values = list(obj.browse_categories) if obj.browse_categories else []
        
        if not values:
            return "-"
        
        # Get display names from choices
        from .models import BROWSE_CATEGORY_CHOICES
        choices_dict = dict(BROWSE_CATEGORY_CHOICES)
        display_names = [choices_dict.get(value, value) for value in values]
        
        return ", ".join(display_names)
    
    browse_categories_display.short_description = "Browse Categories"

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
