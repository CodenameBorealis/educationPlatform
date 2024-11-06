from django.shortcuts import render
from django.views import View

# Create your views here.

class Home(View):
    template_name = "home.html"

    def get(self, request, *args, **kwargs):
        context = {
            "contextText": "Testing"
        }

        return render(request, self.template_name, context)