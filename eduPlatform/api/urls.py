from django.urls import path
from . import views

urlpatterns = [
    path("testing_api/", views.apiTest1) 
]