from django.contrib import admin
from .models import Deposit

@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    list_display = ['title', 'state', 'deposit_type', 'created_at', 'modified_at']
    list_filter = ['state', 'deposit_type', 'is_draft']
    search_fields = ['title']
    readonly_fields = ['created_at', 'modified_at']
    filter_horizontal = ['collections', 'involved_users']