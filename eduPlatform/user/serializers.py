from rest_framework import serializers
from django.utils import timezone
from django.contrib.auth import get_user_model
import re

def validation_error_to_string(error):
    if isinstance(error.detail, list):
        return ', '.join(error.detail)  # If it's a list, just join the messages
    else:
        return ', '.join([f"{field}: {', '.join(msg)}" for field, msg in error.detail.items()])
            
 

class UserSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length = 50,
        required = True
    )

    email = serializers.EmailField(
        required = True
    )

    password = serializers.CharField(
        max_length = 72,
        required = True
    )

    description = serializers.CharField(
        max_length = 350,
        required = False,
        default = "Hi, I'm new around here!"
    )
    
    is_staff = serializers.BooleanField(required=False, default=False)
    is_superuser = serializers.BooleanField(required=False, default=False)
    is_active = serializers.BooleanField(required=False, default=True)
    date_joined = serializers.DateField(required=False, default=timezone.now)

    def validate_username(self, value):
        User = get_user_model()
        
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        
        if " " in value:
            raise serializers.ValidationError("Username should not contain spaces.")
        
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, underscores, and periods."
            )
          
        return value
    
    def validate_password(self, value):   
        if " " in value:
            raise serializers.ValidationError("Password should not contain spaces.")
        
        if not re.match(r'^[a-zA-Z0-9_:;/]+$', value):
            raise serializers.ValidationError(
                "Password can only contain letters, numbers, underscores, and special letters (:;/)."
            )
          
        return value