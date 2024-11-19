from rest_framework import serializers
from django.contrib.auth import get_user_model
from . import models

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username'] 

class ConferenceSerializer(serializers.ModelSerializer):
    host = UserSerializer(read_only=True)
    allowed_users = UserSerializer(many=True, read_only=True)
    token = serializers.CharField(max_length=65, required=True)
    
    class Meta:
        model = models.Conference
        fields = ('id', 'name', 'host', 'allowed_users')
    
    def create(self, validated_data):
        allowed_users = validated_data.pop('allowed_users')
        conference = models.Conference.objects.create(**validated_data)
        
        conference.allowed_users.set(allowed_users)
        
        return conference

class SignalingDataSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=65)
    from_user = serializers.CharField(max_length=255, required=False)
    to_user = serializers.CharField(max_length=255, required=False)
    offer = serializers.JSONField(required=False)
    answer = serializers.JSONField(required=False)
    candidate = serializers.JSONField(required=False)
    join = serializers.BooleanField(required=False, default=False)