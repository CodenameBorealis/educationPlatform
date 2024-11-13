from django.shortcuts import render
from django.views import View
from django.http import *
from django.conf import settings
from django.shortcuts import redirect
from django.contrib.auth import get_user_model, authenticate, login, logout
from os.path import splitext

from json import loads

# Create your views here.

# A class responsible for giving out the profile pictures of users
class GetProfilePicture(View):
    pics_path = settings.BASE_DIR / "uploads/profile_pictures"
    default = pics_path / "Pfp_default.png"

    def get(self, request, *args, **kwargs):
        # Only allow authenticated users to access the api
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("Not logged into an account.")
        
        user_id = int(request.GET.get("user_id"))
        
        # No user_id given or malformed data
        if not user_id:
            return HttpResponseNotFound("Missing user_id argument.")
        
        User = get_user_model()
        user = User.objects.get(id=user_id if user_id != -1 else request.user.id)
        
        if not user: # No user
            return HttpResponseNotFound("User not found")
        
        # Sets the path to pfp link if it exists, or the default one and gives the extention of it
        picture_filename = str(user.profile_picture)
        picture_path = self.pics_path / picture_filename if picture_filename else self.default
        
        full_path, extension = splitext(picture_path)
        
        return FileResponse(open(full_path + extension, "rb"), as_attachment=True, filename=f"profile_pic{extension}")

# A class responsible for getting the name of the user
class GetUserName(View):
    def get(self, request, *args, **kwargs):
        # Check if user is logged in
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this page.")

        # If user_id query is given and not equal to -1 then use it, otherwise use original requester id
        user_id = int(request.GET.get("user_id") if int(request.GET.get("user_id")) != -1 else request.user.id)
        User = get_user_model()
        
        if not user_id:
            return HttpResponseBadRequest("User does not exist.")
        
        user = None
        
        # Try to get user data from the database
        try:
            user = User.objects.get(id=user_id)
        except Exception as ex:
            return HttpResponseBadRequest("User does not exist.")
        
        return JsonResponse({
            "success": True,
            "data": {
                "user_id": user.id,
                "username": user.username
            }
        })

# Class responsible for getting user information
class GetUserInfo(View):
    def get(self, request, *args, **kwargs):
        # Restrict usage only for authenticated users
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this api.")
        
        user = request.user
        
        return JsonResponse({ # Return all the data about their account
            "success": True,
            "data": {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "description": user.description,
                "date_joined": str(user.date_joined),
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser
            }
        })

# Class responsible for saving user description
class SaveDescription(View):
    def post(self, request, *args, **kwargs):
        # Make sure user is logged in
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this api.")

        json_data = loads(request.body)
        
        if not json_data or not json_data.get("description"):
            return HttpResponseBadRequest("No json data given.")
        
        if len(json_data.get("description")) > 350:
            return JsonResponse({
                "success": False,
            })

        try:
            user = request.user
            user.description = json_data.get("description")
            user.save()
            
            return JsonResponse({
                "success": True,
            })
        except Exception:
            return JsonResponse({
                "success": False,
            })

# Class responsible for logging the user into the account
class Login(View):
    def post(self, request, *args, **kwargs):
        if not request.body:
            return HttpResponseBadRequest("Missing request data.")
        
        json_data = loads(request.body)

        # If data is invalid return badrequest.
        if not json_data or not json_data.get("username") or not json_data.get("password"):
            return HttpResponseBadRequest("Missing json data.")

        user = authenticate(request, username=json_data.get("username"), password=json_data.get("password"))

        # Successfully authenticated user, return success and redirect user
        if user:
            login(request, user)
            return JsonResponse({
                "success": True,
                "error_message": ""
            })
        else: # Otherwise return false and specify the error
            return JsonResponse({
                "success": False,
                "error_message": "Incorrect username or password"
            })

# Class responsible for logging the user out of their account
class Logout(View):
    def get(self, request, *args, **kwargs):
        # Only let logged in users access this page
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this page")

        # Logout the user
        logout(request)
        
        return redirect("/login")