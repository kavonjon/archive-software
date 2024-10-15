from django.db.models import Prefetch
from rest_framework import serializers
from .models import Item, Language
import logging

logger = logging.getLogger(__name__)

class ItemMigrateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['id', 'migrate']
    
class LanguageSerializer(serializers.ModelSerializer):
    child_languoids = serializers.SerializerMethodField()
    parent_languoid = serializers.SerializerMethodField()
    family_languoid = serializers.SerializerMethodField()
    pri_subgroup_languoid = serializers.SerializerMethodField()
    sec_subgroup_languoid = serializers.SerializerMethodField()
    language_languoid = serializers.SerializerMethodField()
    level_display = serializers.SerializerMethodField()

    class Meta:
        model = Language
        fields = '__all__'

    def get_level_display(self, obj):
        return obj.get_level_display()

    def get_languoid_data(self, obj):
        return {'id': obj.id, 'name': obj.name, 'glottocode': obj.glottocode} if obj else None

    def get_child_languoids(self, obj):
        return [self.get_languoid_data(child) for child in obj.child_languoids.all()]

    def get_parent_languoid(self, obj):
        return self.get_languoid_data(obj.parent_languoid)

    def get_family_languoid(self, obj):
        return self.get_languoid_data(obj.family_languoid)

    def get_pri_subgroup_languoid(self, obj):
        return self.get_languoid_data(obj.pri_subgroup_languoid)

    def get_sec_subgroup_languoid(self, obj):
        return self.get_languoid_data(obj.sec_subgroup_languoid)

    def get_language_languoid(self, obj):
        return self.get_languoid_data(obj.language_languoid)


class LanguagesUpdateSerializer(serializers.ModelSerializer):
    child_languoids = serializers.PrimaryKeyRelatedField(many=True, queryset=Language.objects.all(), required=False)
    family_languoid = serializers.PrimaryKeyRelatedField(queryset=Language.objects.all(), allow_null=True, required=False)
    pri_subgroup_languoid = serializers.PrimaryKeyRelatedField(queryset=Language.objects.all(), allow_null=True, required=False)
    sec_subgroup_languoid = serializers.PrimaryKeyRelatedField(queryset=Language.objects.all(), allow_null=True, required=False)
    parent_languoid = serializers.PrimaryKeyRelatedField(queryset=Language.objects.all(), allow_null=True, required=False)
    language_languoid = serializers.PrimaryKeyRelatedField(queryset=Language.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Language
        fields = '__all__'

    def update(self, instance, validated_data):
        logger.info(f"Updating instance {instance.id} with data: {validated_data}")
        
        child_languoids = validated_data.pop('child_languoids', None)
        
        for attr, value in validated_data.items():
            logger.info(f"Setting {attr} to {value}")
            setattr(instance, attr, value)
        
        instance.full_clean()
        instance.save()
        logger.info(f"Instance {instance.id} saved")

        if child_languoids is not None:
            instance.child_languoids.set(child_languoids)
            logger.info(f"Updated child_languoids for instance {instance.id}")

        return instance