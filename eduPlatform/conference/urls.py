from django.urls import path
from . import views

urlpatterns = [
    path("<str:token>/", views.Conference.as_view(), name="conference")
]