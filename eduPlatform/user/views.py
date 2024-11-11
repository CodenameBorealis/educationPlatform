from django.shortcuts import render
from django.views import View
from django.http import HttpResponseNotAllowed, HttpResponseForbidden, HttpResponseNotFound, FileResponse
from django.conf import settings
from django.contrib.auth import get_user_model
from os.path import splitext

from json import loads

# Create your views here.

class GetProfilePicture(View):
    path = settings.BASE_DIR / "uploads/profile_pictures"
    default = path / "Pfp_default.png"

    def get(self, request, *args, **kwargs):
        if request.method != "GET":
            return HttpResponseNotAllowed(["GET"])
        
        if not request.user or not request.user.is_authenticated:
            return HttpResponseForbidden("Not logged into an account.")
        
        user_id = int(request.GET.get("user_id"))
        
        if not user_id:
            return HttpResponseNotFound("Missing user_id argument.")
        
        User = get_user_model()
        user = User.objects.get(id=user_id)
        
        if not user:
            return HttpResponseNotFound("User not found")
        
        path, extension = splitext(user.profile_picture or self.default)
        
        return FileResponse(open(path+extension, "rb"), as_attachment=True, filename=f"profile_pic{extension}")