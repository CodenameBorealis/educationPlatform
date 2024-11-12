from django.urls import path
from . import views

urlpatterns = [
    path("get_pfp/", views.GetProfilePicture.as_view()),
    path("login/", views.Login.as_view()),
    path("logout/", views.Logout.as_view()),
    path("get_username/", views.GetUserName.as_view())
]