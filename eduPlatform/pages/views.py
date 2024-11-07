from django.shortcuts import render, redirect
from django.views import View

# Create your views here.

class Home(View):
    template_name = "home.html"


    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("/user/login")

        context = {
            "contextText": "Testing"
        }

        return render(request, self.template_name, context)