import rest_framework.status as status

from django.shortcuts import render
from django.views import View
from django.core.cache import cache
from django.shortcuts import redirect

from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Conference as ConferenceModel
from .mixins import ConferencePermissionsMixin


class Conference(View):
    def get(self, request, token, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return redirect("home")

        return render(request, "conference.html")


class GetMessageHistory(APIView, ConferencePermissionsMixin):
    """
    An API located at /conference/api/get-message-history/?token=<Conference token>
    It's quite simple and just sends over the cache (message logs/history) that has been saved by the signaling server
    """

    def get(self, request, *args, **kwargs):
        self.validate_request(request)

        token = request.GET["token"]

        cache_key = f"conference_message_cache_{token}"
        history = cache.get(cache_key, [])

        data = {"success": True, "history": history}

        return Response(data, status=status.HTTP_200_OK)


class GetConferenceData(APIView, ConferencePermissionsMixin):
    """
    An API located at /conference/api/get-data/?token=<token>
    Used for fetching information about the conference using a token as a reference.
    """

    def get(self, request, *args, **kwargs):
        conference = self.validate_request(request)
        data = {"success": True, "host": conference.host.id, "name": conference.name}

        return Response(data, status=status.HTTP_200_OK)
