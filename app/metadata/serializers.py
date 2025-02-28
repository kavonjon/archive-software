from django.db.models import Prefetch
from rest_framework import serializers
from .models import Item, Languoid

class ItemMigrateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['id', 'migrate']

class LegacyLanguoidSerializer(serializers.ModelSerializer):
    class Meta:
        model = Languoid
        fields = '__all__'