from django.contrib.auth.base_user import BaseUserManager
from django.utils.translation import gettext_lazy as _
from .serializers import UserSerializer
from rest_framework.serializers import ValidationError

class CustomUserManager(BaseUserManager):
    def create_user(self, **extra_fields):
        serializer = UserSerializer(data=extra_fields)
        
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
            
        data = serializer.validated_data
        user = self.model(**data)

        if data.get("password"):
            user.set_password(data.get("password"))
            
        user.save()

        return user
    
    def create_superuser(self, username, email, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") == False:
            raise ValueError(_("Superuser must have is_staff set to True"))
        
        if extra_fields.get("is_superuser") == False:
            raise ValueError(_("Superuser must have is_superuser set to True"))
        
        return self.create_user(username=username, email=email, **extra_fields)

    def create_testuser(self):
        return self.create_user(username="test", email="test@test.com", password="test")