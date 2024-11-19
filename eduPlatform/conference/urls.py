from django.urls import path
from . import views

urlpatterns = [
    path("web/<str:token>/", views.Conference.as_view(), name="conference"),
]