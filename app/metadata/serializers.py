from django.db.models import Prefetch
from rest_framework import serializers
from .models import Item

class ItemMigrateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['id', 'migrate']