from django.shortcuts import render
from django.views import View
from django.conf import settings
from django.shortcuts import redirect
from django.http import FileResponse
from django.contrib.auth import get_user_model, authenticate, login, logout

from rest_framework.views import APIView
from rest_framework.serializers import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import rest_framework.status as status

from PIL import Image, ImageOps

from os.path import splitext, exists
from . import serializers

from json import loads

# A class responsible for giving out the profile pictures of users
class GetProfilePicture(APIView):
    permission_classes = [IsAuthenticated]
    
    pics_path = settings.UPLOAD_DIR / "profile_pictures"
    default = settings.STATIC_ROOT / "user/Pfp_default.png"
    
    def get(self, request, *args, **kwargs):
        user_id = int(request.GET.get("user_id"))
        
        # No user_id given or malformed data
        if not user_id:
            return Response("Missing user_id argument.", status.HTTP_404_NOT_FOUND)
        
        User = get_user_model()
        user = User.objects.get(id=user_id if user_id != -1 else request.user.id)
        
        if not user: # No user
            return Response("User not found", status.HTTP_404_NOT_FOUND)
        
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
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        if not request.GET.get("user_id"):
            return Response("No user_id given.", status.HTTP_400_BAD_REQUEST)

        # If user_id query is given and not equal to -1 then use it, otherwise use original requester id
        user_id = int(request.GET.get("user_id") if int(request.GET.get("user_id")) != -1 else request.user.id)
        User = get_user_model()
        
        if not user_id:
            return Response("User does not exist.", status.HTTP_400_BAD_REQUEST)
        
        user = None
        
        # Try to get user data from the database
        try:
            user = User.objects.get(id=user_id)
        except Exception as ex:
            return Response("User does not exist.", status.HTTP_400_BAD_REQUEST)
        
        return Response({
            "success": True,
            "data": {
                "user_id": user.id,
                "username": user.username
            }
        })

# Class responsible for getting user information
class GetUserInfo(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        user = request.user
        
        return Response({ # Return all the data about their account
            "success": True,
            "data": {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "description": user.description,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser
            }
        })

# Class responsible for logging the user into the account
class Login(APIView):
    def post(self, request, *args, **kwargs):
        if not request.body:
            return Response("Missing request data.", status.HTTP_400_BAD_REQUEST)
        
        data = request.data

        # If data is invalid return badrequest.
        if not data or not data.get("username") or not data.get("password"):
            return Response("Missing json data.", status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=data.get("username"), password=data.get("password"))

        # Successfully authenticated user, return success and redirect user
        if user:
            login(request, user)
            return Response({
                "success": True,
                "error_message": ""
            })
        else: # Otherwise return false and specify the error
            return Response({
                "success": False,
                "error_message": "Incorrect username or password"
            })

# Class responsible for logging the user out of their account
class Logout(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        # Logout the user
        logout(request)
        
        return redirect("/login")

# Class responsible for saving user description
class SaveDescription(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        data = request.data
        
        if not data or not data.get("description"):
            return Response("No json data given.", status.HTTP_400_BAD_REQUEST)
        
        if len(data.get("description")) > 350:
            return Response({
                "success": False,
            })

        try:
            user = request.user
            user.description = data.get("description")
            user.save()
            
            return Response({
                "success": True,
            })
        except Exception:
            return Response({
                "success": False,
            })

# Class responsible for changing user's username
class ChangeUsername(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        data = request.data
        
        User = get_user_model()
        user = request.user
        
        if not data or not data.get("username") or not data.get("password"):
            return Response("Invalid JSON data.", status.HTTP_400_BAD_REQUEST)
            
        if not user.check_password(data.get("password")):
            return Response({
                "success": False,
                "error_message": "Invalid password."
            })
            
        try:
            serializer = serializers.UserSerializer()
            validated = serializer.validate_username(data.get("username"))
            
            user.username = validated
            user.save()
            
            return Response({
                "success": True,
                "error_message": ""
            })
        except ValidationError as error:
            return Response({
                "success": False,
                "error_message": serializers.validation_error_to_string(error)
            })

# Class responsible for changing user's profile picture
class ChangeProfilePicture(APIView):
    permission_classes = [IsAuthenticated]
    upload_path = settings.UPLOAD_DIR / "profile_pictures"
    
    def post(self, request, *args, **kwargs):
        serializer = serializers.UploadProfilePictureSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({
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
        
        return Response({
            "success": True,
            "error_message": ""
        })

# Class responsible for changing user's password
class ChangePassword(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        data = request.data
        user = request.user
        
        if not data.get("new_password") or not data.get("old_password"):
            return Response("Invalid JSON data.", status.HTTP_400_BAD_REQUEST)
        
        if not user.check_password(data.get("old_password")):
            return Response({
                "success": False,
                "error_message": "Invalid old password."
            })
        
        if user.check_password(data.get("new_password")):
            return Response({
                "success": False,
                "error_message": "Cannot change the password to the same one."
            })
        
        serializer = serializers.UserSerializer()
        
        try:
            validated = serializer.validate_password(data.get("new_password"))
            user.set_password(validated)
            user.save()
            
            login(request, user)
            
            return Response({
                "success": True,
                "error_message": ""
            })
        except ValidationError as error:
            return Response({
                "success": False,
                "error_message": serializers.validation_error_to_string(error)
            })
    
# Class responsible for changing user's email address        
class ChangeEmail(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        serialzier = serializers.EmailChangeSerializer(data=request.data)
        
        if not serialzier.is_valid():
            return Response({
                "success": False,
                "error_message": serializers.validation_errors_to_string(serialzier.errors)
            })
        
        validated = serialzier.validated_data
        
        if not request.user.check_password(validated.get("password")):
            return Response({
                "success": False,
                "error_message": "Invalid user password"
            })
        
        request.user.email = validated.get("email")
        request.user.save()
        
        return Response({
            "success": True,
            "error_message": ""
        })
        