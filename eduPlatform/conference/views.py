import rest_framework.status as status

from django.shortcuts import render
from django.views import View
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Conference as ConferenceModel

class Conference(View):
    def get(self, request, token, *args, **kwargs):
        return render(request, "conference_test.html")

class GetMessageHistory(APIView):
    def get(self, request, *args, **kwargs):
        if not self.request.user or not self.request.user.is_authenticated:
            return Response("You must be logged in to access this api.", status=status.HTTP_403_FORBIDDEN)
        
        token = self.request.GET.get("token")
        if not token:
            return Response("No token given.", status=status.HTTP_400_BAD_REQUEST)
        
        if not ConferenceModel.objects.filter(token=token).exists():
            return Response("Invalid token given", status=status.HTTP_400_BAD_REQUEST)
        
        cache_key = f"conference_message_cache_{token}"
        history = cache.get(cache_key, [])
        
        data = {
            "success": True,
            "history": history
        }
        
        return Response(data, status=status.HTTP_200_OK)
        