from django.db import models
# Create your models here.

class TestInformation(models.Model):
    name        = models.CharField(max_length=120, null=False, default="Info_Name")
    description = models.CharField(max_length=400, null=False, default="Info_Description")