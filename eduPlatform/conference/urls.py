from django.urls import path
from . import views

urlpatterns = [
    path("web/<str:token>/", views.Conference.as_view(), name="conference"),
    
    # Api
    path("api/get-message-history/", views.GetMessageHistory.as_view()),
    path("api/get-data/", views.GetConferenceData.as_view()),
    path("api/start/", views.StartConference.as_view()),
    path("api/end/", views.EndConference.as_view()),
    path("api/upload-presentation/", views.UploadPresentation.as_view()),
    path("api/get-task-info/", views.GetTaskInformation.as_view()),
    path("api/get-presentation-slide/", views.GetPresentationSlide.as_view()),
    path("api/get-presentation-page-count/", views.GetPresentationPageCount.as_view())
]