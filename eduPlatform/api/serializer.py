from rest_framework import serializers
from . import models

class DataSerializer(serializers.Serializer):
    name        = serializers.CharField(max_length=120)
    description = serializers.CharField(max_length=120)
    