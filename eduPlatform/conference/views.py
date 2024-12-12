import secrets

import rest_framework.status as status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import render
from django.views import View
from django.core.cache import cache
from django.shortcuts import redirect
from django.utils.timezone import now
from django.conf import settings

from datetime import timedelta
from os import path

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from celery.result import AsyncResult
from celery.app.control import Control

from .mixins import ConferencePermissionsMixin
from . import tasks as tasks
from . import serializers


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
            "end_time": conference.end_time,
            "max_duration": conference.max_conference_duration,
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

        duration = conference.max_conference_duration
        if duration > 0:
            end_time = now() + timedelta(minutes=duration, seconds=5)
            task = tasks.end_conference.apply_async([conference.token], eta=end_time)
            conference.celery_task_id = task.id

        conference.started = True
        conference.start_time = now()

        conference.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"signaling_{request.GET['token']}",
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

        if conference.celery_task_id:
            control = Control(app=tasks.end_conference.app)
            control.revoke(conference.celery_task_id, terminate=True)

            conference.celery_task_id = None
            conference.save()

        tasks.end_conference(conference.token)

        return Response("Successfully ended the conference.", status=status.HTTP_200_OK)


class UploadPresentation(APIView, ConferencePermissionsMixin):
    """
    An API call located at /conference/api/upload-presentation/?token=<token>

    Used by hosts or co-hosts for uploading presentations or documents to the server
    which will be processed with a celery task and later loaded on all the clients of the conference
    """

    upload_path = settings.UPLOAD_DIR / "documents"

    def post(self, request, *args, **kwargs):
        conference = self.validate_request(request)
        serializer = serializers.PresentationUploadSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = serializer.validated_data["file"]
        extension = path.splitext(uploaded_file.name)[1]
        file_token = secrets.token_hex(16)
        save_path = self.upload_path / f"{file_token}{extension}"

        with open(save_path, "wb+") as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        result = tasks.process_document.apply_async((conference.token, str(save_path)))

        return Response(
            {"task_id": result.id, "file_token": file_token, "success": True},
            status=status.HTTP_200_OK,
        )


class GetTaskInformation(APIView):
    """
    An API call located at /conference/api/get-task-info/?id=<task id>

    Used for fetching information about celery tasks; for example get status of
    file conversion which was uploaded by the host as a presentation
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        id = request.GET.get("id")
        if not id:
            return Response("No task ID was given.", status=status.HTTP_400_BAD_REQUEST)

        result = AsyncResult(id)
        return_data = {
            "status": result.status,
            "result": result.result,
            "successful": result.successful(),
            "failed": result.failed(),
        }

        return Response(return_data, status=status.HTTP_200_OK)
