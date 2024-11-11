from django.contrib.auth.base_user import BaseUserManager
from django.utils.translation import gettext_lazy as _

class CustomUserManager(BaseUserManager):
    def create_user(self, username, email, **extra_fields):
        if not username:
            raise ValueError(_("Username must be set"))
        
        if not email:
            raise ValueError(_("Email must be set"))

        user = self.model(username=username, email=email, **extra_fields)

        if extra_fields.get("password"):
            user.set_password(extra_fields.get("password"))
            
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
        
        return self.create_user(username, email, **extra_fields)

    def create_testuser(self):
        return self.create_user(username="test", email="test@test.com", password="test")