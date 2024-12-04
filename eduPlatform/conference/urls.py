from django.urls import path
from . import views

urlpatterns = [
    path("web/<str:token>/", views.Conference.as_view(), name="conference"),
    
    # Api
    path("api/get-message-history/", views.GetMessageHistory.as_view()),
    path("api/get-data/", views.GetConferenceData.as_view())
]