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
    
    class Meta:
        model = models.Conference
        fields = ('id', 'name', 'host', 'allowed_users')
    
    def create(self, validated_data):
        allowed_users = validated_data.pop('allowed_users')
        conference = models.Conference.objects.create(**validated_data)
        
        conference.allowed_users.set(allowed_users)
        
        return conference