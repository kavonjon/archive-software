from django.db.models import Prefetch
from rest_framework import serializers
from .models import Item, Language

class ItemMigrateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['id', 'migrate']

class LegacyLanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = '__all__'