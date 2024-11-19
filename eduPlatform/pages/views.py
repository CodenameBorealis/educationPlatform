from django.shortcuts import render
from django.views import View
from django.contrib.auth import authenticate, login
from django.shortcuts import redirect
from django.http import JsonResponse, HttpResponseBadRequest

import json

class Home(View):
    template_name = "home.html"

    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("/login")

        return render(request, self.template_name)
class Login(View):
    template_name = "user/login.html"

    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated: # If the user is logged in, just redirect them to the main page
            return redirect("home")
        
        return render(request, self.template_name)

class ProfileSettings(View):
    template_name = "user/profile_settings.html"
    
    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("/login")
        
        return render(request, self.template_name)