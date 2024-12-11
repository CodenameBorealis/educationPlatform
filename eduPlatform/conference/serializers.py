from rest_framework import serializers
from django.contrib.auth import get_user_model

from os import path

from . import models

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username'] 

class ConferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Conference
        fields = ('id', 'name', 'host', 'allowed_users', 'start_time', 'end_time')
        read_only_fields = ['token', 'ended', 'started']
    
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

class PresentationUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    
    ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx']
    
    def validate_file(self, value):
        extension = path.splitext(value.name)[1].lower()
        if extension not in self.ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("This file extension is not allowed, please upload a document or a presentation.")
        
        max_file_size = 25 * 1024 * 1024 # 25 MB
        if value.size > max_file_size:
            raise serializers.ValidationError("File size exeeds the 25 MB limit, please try a different document.")
        
        return value