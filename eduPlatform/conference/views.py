import rest_framework.status as status

from django.shortcuts import render
from django.views import View
from django.core.cache import cache
from django.shortcuts import redirect
from django.utils.timezone import now

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

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
        data = {
            "success": True,
            "host": conference.host.id,
            "name": conference.name,
            "started": conference.started,
            "ended": conference.ended,
            "start_time": conference.start_time,
        }

        return Response(data, status=status.HTTP_200_OK)


class StartConference(APIView, ConferencePermissionsMixin):
    """
    An API located at /conference/api/start/?token=<token>
    Used to start the conference and is only accessible by the host of said conference
    """

    def post(self, request, *args, **kwargs):
        conference = self.validate_request(request)

        if not request.user.id == conference.host.id:
            return Response(
                "You don't have the permissions to start the conference.",
                status=status.HTTP_403_FORBIDDEN,
            )

        if conference.started:
            return Response(
                "The conference has been already started.",
                status=status.HTTP_400_BAD_REQUEST,
            )

        conference.started = True
        conference.start_time = now()

        conference.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"signaling_{request.GET["token"]}",
            {"type": "signaling_message", "message": {"type": "conference-started"}},
        )

        return Response("Sent request to start the meeting.", status=status.HTTP_200_OK)


class EndConference(APIView, ConferencePermissionsMixin):
    """
    An API call located at /conference/api/end/?token=<token>
    
    Automatically disconnects all users from the meeting and puts it into closed state.
    Note: This API is only accessible to the host of the meeting
    """
    
    def post(self, request, *args, **kwargs):
        conference = self.validate_request(request)

        if not request.user.id == conference.host.id:
            return Response(
                "You don't have the permissions to start the conference.",
                status=status.HTTP_403_FORBIDDEN,
            )

        if conference.ended:
            return Response(
                "The conference has already ended", status=status.HTTP_400_BAD_REQUEST
            )

        if not conference.started:
            return Response(
                "Cannot stop a conference that hasn't been started yet.",
                status=status.HTTP_400_BAD_REQUEST,
            )

        conference.ended = True
        conference.end_time = now()
        conference.save()

        channel_layer = get_channel_layer()

        async_to_sync(channel_layer.group_send)(
            f"signaling_{request.GET["token"]}",
            {"type": "signaling_message", "message": {"type": "conference-ended"}},
        )

        async_to_sync(channel_layer.group_send)(
            f"signaling_{request.GET["token"]}",
            {"type": "end_conference"},
        )

        return Response("Successfully ended the conference.", status=status.HTTP_200_OK)
