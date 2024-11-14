from django.test import TestCase
from rest_framework.serializers import ValidationError
from . import serializers

class TestUserSerializer(TestCase):
    def test_valid(self):
        self.serializer = serializers.UserSerializer(data={
            "username": "username",
            "password": "password123",
            "email": "email@abc.com"
        }) 
        
        self.assertTrue(self.serializer.is_valid(raise_exception=True))
    
    def test_valid_full(self):
        self.serializer = serializers.UserSerializer(data={
            "username": "username",
            "password": "password123",
            "email": "email@abc.com",
            "description": "hello world!",
            "is_staff": False,
            "is_superuser": False,
            "is_active": True
        }) 
        
        self.assertTrue(self.serializer.is_valid(raise_exception=True))
    
    def test_invalid_user(self):
        self.serializer = serializers.UserSerializer(data={
            "username": "username ;;",
            "password": "password123",
            "email": "email@abc.com",
            "description": "hello world!",
            "is_staff": False,
            "is_superuser": False,
            "is_active": True
        }) 
        
        with self.assertRaises(ValidationError):
            self.serializer.is_valid(raise_exception=True)
        
    def test_invalid_password(self):
        self.serializer = serializers.UserSerializer(data={
            "username": "username",
            "password": "pas  sw  ord123 ",
            "email": "email@abc.com",
            "description": "hello world!",
            "is_staff": False,
            "is_superuser": False,
            "is_active": True
        }) 

        with self.assertRaises(ValidationError):    
            self.serializer.is_valid(raise_exception=True)
    
    def test_invalid_email(self):
        self.serializer = serializers.UserSerializer(data={
            "username": "username ",
            "password": "password123",
            "email": "emaiabc.com",
            "description": "hello world!",
            "is_staff": False,
            "is_superuser": False,
            "is_active": True
        }) 
         
        with self.assertRaises(ValidationError):    
            self.serializer.is_valid(raise_exception=True)