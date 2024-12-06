import uuid

from django.db import models
from django.contrib.auth import get_user_model

# Database model for the conference
class Conference(models.Model):
    host = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name="hosted_conferences")
    name = models.CharField(max_length=165, default="Meeting")
    token = models.CharField(max_length=65, unique=True, blank=True)
    
    allowed_users = models.ManyToManyField(get_user_model(), related_name="conferences")

    started = models.BooleanField(default=False)
    ended = models.BooleanField(default=False)
    
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = uuid.uuid4().hex
        
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name