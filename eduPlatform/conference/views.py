from django.shortcuts import render
from django.views import View

class Conference(View):
    def get(self, request, token, *args, **kwargs):
        return render(request, "conference.html")