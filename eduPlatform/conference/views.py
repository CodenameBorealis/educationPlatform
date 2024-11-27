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
    """
    An API located at /conference/api/get-message-history/?token=<Conference token>
    It's quite simple and just sends over the cache (message logs/history) that has been saved by the signaling server
    """
    
    def get(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return Response(
                "You must be logged in to access this api.",
                status=status.HTTP_403_FORBIDDEN,
            )

        token = request.GET.get("token")
        if not token:
            return Response("No token given.", status=status.HTTP_400_BAD_REQUEST)

        if not ConferenceModel.objects.filter(token=token).exists():
            return Response("Invalid token given", status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"conference_message_cache_{token}"
        history = cache.get(cache_key, [])

        data = {"success": True, "history": history}

        return Response(data, status=status.HTTP_200_OK)


class GetConferenceHostID(APIView):
    """
    An API located at /conference/api/get-host/?token=<Conference token>
    Just as simple as the previous one, but this one just retrieves and sends over the id of the conference host to the client
    """
    
    def get(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return Response(
                "You must be logged in to access this api.",
                status=status.HTTP_403_FORBIDDEN,
            )

        token = request.GET.get("token")
        if not token:
            return Response("No token given.", status=status.HTTP_400_BAD_REQUEST)

        if not ConferenceModel.objects.filter(token=token).exists():
            return Response("Invalid token given", status=status.HTTP_400_BAD_REQUEST)

        conference = ConferenceModel.objects.get(token=token)
        data = {"success": True, "host": conference.host.id}

        return Response(data, status=status.HTTP_200_OK)
