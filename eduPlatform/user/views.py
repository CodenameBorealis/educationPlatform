from django.shortcuts import render
from django.views import View
from django.http import *
from django.conf import settings
from django.shortcuts import redirect
from django.contrib.auth import get_user_model, authenticate, login, logout

from rest_framework.views import APIView
from rest_framework.serializers import ValidationError

from PIL import Image, ImageOps

from os.path import splitext, exists
from . import serializers

from json import loads

# A class responsible for giving out the profile pictures of users
class GetProfilePicture(APIView):
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
        
        if not exists(full_path + extension):
            request.user.profile_picture = ""
            request.user.save()
            
            picture_path = self.default
            full_path, extension = splitext(picture_path)
            
        
        return FileResponse(open(full_path + extension, "rb"), as_attachment=True, filename=f"profile_pic{extension}")

# A class responsible for getting the name of the user
class GetUserName(APIView):
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
class GetUserInfo(APIView):
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

# Class responsible for logging the user into the account
class Login(APIView):
    def post(self, request, *args, **kwargs):
        if not request.body:
            return HttpResponseBadRequest("Missing request data.")
        
        data = request.data

        # If data is invalid return badrequest.
        if not data or not data.get("username") or not data.get("password"):
            return HttpResponseBadRequest("Missing json data.")

        user = authenticate(request, username=data.get("username"), password=data.get("password"))

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
class Logout(APIView):
    def get(self, request, *args, **kwargs):
        # Only let logged in users access this page
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this page")

        # Logout the user
        logout(request)
        
        return redirect("/login")

# Class responsible for saving user description
class SaveDescription(APIView):
    def post(self, request, *args, **kwargs):
        # Make sure user is logged in
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this api.")

        data = request.data
        
        if not data or not data.get("description"):
            return HttpResponseBadRequest("No json data given.")
        
        if len(data.get("description")) > 350:
            return JsonResponse({
                "success": False,
            })

        try:
            user = request.user
            user.description = data.get("description")
            user.save()
            
            return JsonResponse({
                "success": True,
            })
        except Exception:
            return JsonResponse({
                "success": False,
            })

# Class responsible for changing user's username
class ChangeUsername(APIView):
    def post(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this api.")
        
        data = request.data
        
        User = get_user_model()
        user = request.user
        
        if not data or not data.get("username") or not data.get("password"):
            return HttpResponseBadRequest("Invalid JSON data.")
            
        if not user.check_password(data.get("password")):
            return JsonResponse({
                "success": False,
                "error_message": "Invalid password."
            })
            
        try:
            serializer = serializers.UserSerializer()
            validated = serializer.validate_username(data.get("username"))
            
            user.username = validated
            user.save()
            
            return JsonResponse({
                "success": True,
                "error_message": ""
            })
        except ValidationError as error:
            return JsonResponse({
                "success": False,
                "error_message": serializers.validation_error_to_string(error)
            })

# Class responsible for changing user's profile picture
class ChangeProfilePicture(APIView):
    upload_path = settings.BASE_DIR / "uploads/profile_pictures"
    
    def post(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this API.")
        
        serializer = serializers.UploadProfilePictureSerializer(data=request.data)
        
        if not serializer.is_valid():
            return JsonResponse({
                "success": False,
                "error_message": serializers.validation_errors_to_string(serializer.errors)
            })
        
        uploaded_image =  serializer.validated_data["image"]
        img = Image.open(uploaded_image)
        
        if img.mode != "RGB":
            img = img.convert("RGB")
            
        square_img = ImageOps.fit(img, (max(img.size), max(img.size)), method=Image.LANCZOS, centering=(0.5, 0.5))
        final_img = square_img.resize((256, 256), Image.LANCZOS)
        
        filename = f"profile_picture_{request.user.id}.jpg"
        save_path = self.upload_path / filename
        
        final_img.save(save_path)
        
        request.user.profile_picture = filename
        request.user.save()
        
        return JsonResponse({
            "success": True,
            "error_message": ""
        })
        

# Class responsible for changing user's password
class ChangePassword(APIView):
    def post(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("You must be logged in to access this API.")
        
        data = request.data
        user = request.user
        
        if not data.get("new_password") or not data.get("old_password"):
            return HttpResponseBadRequest("Invalid JSON data.")
        
        if not user.check_password(data.get("old_password")):
            return JsonResponse({
                "success": False,
                "error_message": "Invalid old password."
            })
        
        if user.check_password(data.get("new_password")):
            return JsonResponse({
                "success": False,
                "error_message": "Cannot change the password to the same one."
            })
        
        serializer = serializers.UserSerializer()
        
        try:
            validated = serializer.validate_password(data.get("new_password"))
            user.set_password(validated)
            user.save()
            
            login(request, user)
            
            return JsonResponse({
                "success": True,
                "error_message": ""
            })
        except ValidationError as error:
            return JsonResponse({
                "success": False,
                "error_message": serializers.validation_error_to_string(error)
            })