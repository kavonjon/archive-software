from django.contrib import admin
from .models import Deposit, DepositFile

@admin.register(DepositFile)
class DepositFileAdmin(admin.ModelAdmin):
    list_display = ('filename', 'deposit', 'uploaded_by', 'uploaded_at', 'filesize', 'is_metadata_file')
    list_filter = ('is_metadata_file', 'uploaded_at', 'deposit')
    search_fields = ('filename', 'deposit__title', 'uploaded_by__username')
    readonly_fields = ('uploaded_at', 'filesize')

@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    list_display = ('title', 'state', 'draft_user', 'created_at', 'file_count')
    list_filter = ('state', 'created_at', 'deposit_type')
    search_fields = ('title', 'draft_user__username')
    filter_horizontal = ('involved_users', 'collections')
    readonly_fields = ('created_at', 'modified_at', 'file_count')