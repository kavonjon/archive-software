from rest_framework import serializers
from metadata.models import Collection

class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = [
            'id',
            'collection_abbr',
            'name',
            'extent',
            'abstract',
            'description',
            # Add other relevant fields from your Collection model
        ] 