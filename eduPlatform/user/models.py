from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .managers import CustomUserManager

class CustomUser(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(_("Username"), unique=True, max_length=50)
    email = models.EmailField(_("Email address"), unique=True, null=False, default="")
    
    profile_picture = models.ImageField(_("Profile picture"), blank=True)
    description = models.CharField(_("Profile description"), unique=False, max_length=350, default="Hi, I'm new around here!")
    
    is_staff = models.BooleanField(_("Is staff"), default=False)
    is_active = models.BooleanField(_("Is active"), default=True)
    date_joined = models.DateField(_("Date joined"), default=timezone.now)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email", "password"]

    objects = CustomUserManager()

    def __str__(self):
        return self.username