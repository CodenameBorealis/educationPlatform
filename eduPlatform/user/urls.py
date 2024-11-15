from django.urls import path
from . import views

urlpatterns = [
    path("get_pfp/", views.GetProfilePicture.as_view()),
    path("login/", views.Login.as_view()),
    path("logout/", views.Logout.as_view()),
    path("get_username/", views.GetUserName.as_view()),
    path("get_userinfo/", views.GetUserInfo.as_view()),
    path("set_description/", views.SaveDescription.as_view()),
    path("set_username/", views.ChangeUsername.as_view()),
    path("change_profile_picture/", views.ChangeProfilePicture.as_view()),
    path("set_password/", views.ChangePassword.as_view()),
    path("set_email/", views.ChangeEmail.as_view())
]