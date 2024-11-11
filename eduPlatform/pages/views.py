from django.shortcuts import render
from django.views import View
from django.contrib.auth import authenticate, login
from django.shortcuts import redirect
from django.http import JsonResponse, HttpResponseBadRequest

import json

# Create your views here.

class Home(View):
    template_name = "home.html"


    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("/login")

        context = {
            "contextText": "Testing"
        }

        return render(request, self.template_name, context)

class Login(View):
    template_name = "login.html"

    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated: # If the user is logged in, just redirect them to the main page
            return redirect("home")
        
        return render(request, self.template_name)

    def post(self, request, *args, **kwargs): # Handle login request
        if not request:
            return 
        
        json_data = json.loads(request.body)

        if not json_data or not json_data.get("username") or not json_data.get("password"): # If data is invalid return badrequest.
            return HttpResponseBadRequest("Missing json data.")

        user = authenticate(request, username=json_data.get("username"), password=json_data.get("password"))

        if user: # Successfully authenticated user, return success and redirect user
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