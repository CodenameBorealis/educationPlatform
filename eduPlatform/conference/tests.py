import shutil
import os

from django.test import Client, TestCase
from django.test.utils import override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings

from channels.testing import WebsocketCommunicator
from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async as dsa
from channels.layers import get_channel_layer

from io import BytesIO
from asyncio import TimeoutError
from fpdf import FPDF

from eduPlatform.asgi import application
from .consumers import SignalingConsumer
from .models import Conference
from user.tests import BaseUserTest


class SignalingConsumerTest(TestCase):
    async def asyncSetUp(self):
        self.User = get_user_model()
        self.user = await dsa(self.User.objects.create_testuser)()
        self.user.set_password("test")
        await dsa(self.user.save)()

        self.conference = await dsa(Conference.objects.create)(host=self.user)
        self.conference.started = True
        await dsa(self.conference.save)()

        self.communicator = WebsocketCommunicator(
            AuthMiddlewareStack(application), f"/ws/signaling/{self.conference.token}/"
        )
        self.communicator.scope["user"] = self.user

        connected, _ = await self.communicator.connect()
        self.assertTrue(connected, "Failed to connect to websocket")

        self.assertEqual(
            self.communicator.scope["user"].username,
            "test",
            "Invalid scope user username",
        )

    async def asyncTearDown(self):
        await self.communicator.disconnect()

    async def test_not_logged_in(self):
        await self.asyncSetUp()

        communicator = WebsocketCommunicator(
            AuthMiddlewareStack(application), f"/ws/signaling/{self.conference.token}/"
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected, "Connected without proper authentication.")

        await self.asyncTearDown()

    async def test_unauthorized(self):
        await self.asyncSetUp()

        newUser = await dsa(self.User.objects.create)(
            username="test2", email="test@test.c", password="test"
        )
        await dsa(newUser.save)()

        newConference = await dsa(Conference.objects.create)(host=newUser)
        await dsa(newConference.save)()

        communicator = WebsocketCommunicator(
            AuthMiddlewareStack(application), f"/ws/signaling/{newConference.token}/"
        )
        communicator.scope["user"] = self.user

        connected, _ = await communicator.connect()

        self.assertFalse(
            connected, "Connected without being added into the allowed_users list."
        )

        await self.asyncTearDown()

    async def test_data_signaling(self):
        await self.asyncSetUp()

        await self.communicator.send_json_to(
            {
                "type": "new-participant",
                "userId": str(self.user.id),
            },
        )

        response = await self.communicator.receive_json_from(timeout=5)

        self.assertEqual(
            response,
            {
                "from": self.user.id,
                "type": "new-participant",
                "userId": str(self.user.id),
            },
            "Got an invalid JSON response",
        )

        await self.asyncTearDown()

    async def test_concurrent_connections(self):
        await self.asyncSetUp()

        async def _create_communicator(id):
            user = await dsa(self.User.objects.create)(
                username=str(id), password="test", email=f"test{id}@test.c"
            )

            communicator = WebsocketCommunicator(
                AuthMiddlewareStack(application),
                f"/ws/signaling/{self.conference.token}/",
            )
            communicator.scope["user"] = user

            await dsa(user.save)()
            await dsa(self.conference.allowed_users.add)(user)

            return communicator

        communicators = [await _create_communicator(id) for id in range(100)]
        connections = [await communicator.connect() for communicator in communicators]

        for connected, _ in connections:
            self.assertTrue(connected, "Failed to connect websocket.")

    async def test_private_data_signaling(self):
        await self.asyncSetUp()

        channel_layer = get_channel_layer()
        group = f"private_user{self.user.id}"

        data = {
            "type": "signaling_message",
            "message": {
                "type": "test_signal",
                "to": str(self.user.id),
                "from": str(self.user.id),
            },
        }

        await channel_layer.group_send(group, data)

        response = await self.communicator.receive_json_from(timeout=5)

        self.assertEqual(
            response,
            {
                "type": "test_signal",
                "to": str(self.user.id),
                "from": str(self.user.id),
            },
            "Got invalid JSON response.",
        )

        await self.asyncTearDown()

    async def test_global_message(self):
        await self.asyncSetUp()

        await self.communicator.send_json_to(
            {"type": "global-message", "contents": "Hello, world"}
        )

        response = await self.communicator.receive_json_from(timeout=5)

        self.assertEqual(
            response.get("type"), "global-message", "Invalid type returned"
        )
        self.assertEqual(
            response.get("contents"), "Hello, world", "Invalid message contents"
        )
        self.assertEqual(response.get("from"), self.user.id, "Invalid sender user id")

        await self.asyncTearDown()

    async def test_large_message(self):
        await self.asyncSetUp()

        await self.communicator.send_json_to(
            {"type": "global-message", "contents": "A" * 10000}
        )

        response = await self.communicator.receive_json_from(timeout=5)

        self.assertEqual(
            response.get("type"), "global-message", "Invalid type returned"
        )
        self.assertEqual(
            response.get("contents"), "A" * 10000, "Invalid message contents"
        )
        self.assertEqual(response.get("from"), self.user.id, "Invalid sender user id")

        await self.asyncTearDown()

    async def test_missing_type(self):
        await self.asyncSetUp()

        await self.communicator.send_json_to({"contents": "Hello, world"})

        with self.assertRaises(TimeoutError):
            await self.communicator.receive_json_from()


class MessageHistoryTest(BaseUserTest):
    baseURL = "/conference/api/get-message-history/"
    requestType = "GET"

    def setUp(self):
        self.set_up_client()

        self.conference = Conference.objects.create(host=self.user)
        self.conference.save()

    def test_request(self):
        request = self.client.get(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request, expect_json=True)

        json = request.json()

        self.assertTrue(json.get("success"), "JSON success is False.")
        self.assertIsNotNone(json.get("history"), "Missing history field.")

    def test_request_invalid_token(self):
        request = self.client.get(f"{self.baseURL}?token=some-invalid-token")
        self.validate_response(request, 400)

    def test_request_no_token(self):
        request = self.client.get(f"{self.baseURL}")
        self.validate_response(request, 400)


class GetMeetingInfoTest(BaseUserTest):
    baseURL = "/conference/api/get-data/"
    requestType = "GET"

    def setUp(self):
        self.set_up_client()

        self.conference = Conference.objects.create(host=self.user)
        self.conference.save()

    def test_request(self):
        request = self.client.get(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request, expect_json=True)

        json = request.json()

        self.assertTrue(json.get("success"), "JSON success is False.")
        self.assertEqual(
            json.get("host"), self.conference.host.id, "Invalid host ID given."
        )
        self.assertEqual(
            json.get("name"), self.conference.name, "Invalid meeting name given."
        )

    def test_invalid(self):
        request = self.client.get(f"{self.baseURL}?token=totally_invalid")
        self.validate_response(request, 400)

    def test_missing(self):
        request = self.client.get(f"{self.baseURL}")
        self.validate_response(request, 400)


class StartConferenceTest(BaseUserTest):
    baseURL = "/conference/api/start/"

    def setUp(self):
        self.set_up_client()

        self.conference = Conference.objects.create(host=self.user)
        self.conference.save()

    def test_start(self):
        request = self.client.post(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request)

        conference = Conference.objects.get(token=self.conference.token)
        self.assertTrue(
            conference.started, "API did not set conference started to True."
        )
        self.assertIsNotNone(
            conference.start_time, "API failed to set the start_time of the conference."
        )

    def test_already_started(self):
        conference = Conference.objects.create(host=self.user)
        conference.started = True

        conference.save()

        request = self.client.post(f"{self.baseURL}?token={conference.token}")
        self.validate_response(request, 400)

    def test_not_host(self):
        user = self.User.objects.create_user(
            username="test2", email="test2@test.com", password="test2"
        )
        logged_in = self.client.login(username="test2", password="test2")

        self.assertTrue(logged_in, "Failed to log into a testing account.")

        request = self.client.post(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request, 403)


class EndConferenceTest(BaseUserTest):
    baseURL = "/conference/api/end/"

    def setUp(self):
        self.set_up_client()

        self.conference = Conference.objects.create(host=self.user, started=True)
        self.conference.save()

    def test_end_conference(self):
        request = self.client.post(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request)

        conference = Conference.objects.get(token=self.conference.token)

        self.assertTrue(conference.ended, "API failed to set ended to True.")
        self.assertIsNotNone(
            conference.end_time, "API did not set the end time of the conference."
        )

    def test_already_ended(self):
        self.conference.ended = True
        self.conference.save()

        request = self.client.post(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request, 400)

    def test_not_started(self):
        self.conference.started = False
        self.conference.save()

        request = self.client.post(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request, 400)


class DocumentUploadTest(BaseUserTest):
    baseURL = "/conference/api/upload-presentation/"
    
    @staticmethod
    def create_mock_pdf():
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.cell(200, 10, txt="This is a mock PDF for testing.", ln=True, align='C')

        buffer = BytesIO()
        buffer.write(pdf.output(dest='S').encode('latin1'))
        buffer.seek(0) 
        return buffer

    def setUp(self):
        self.set_up_client()

        self.conference = Conference.objects.create(host=self.user)
        self.conference.save()

    def test_no_file(self):
        request = self.client.post(f"{self.baseURL}?token={self.conference.token}")
        self.validate_response(request, 400)

    def test_invalid_format(self):
        file = SimpleUploadedFile(
            "test.txt",
            b"Hello world!",
            content_type="application/txt",
        )
        
        request = self.client.post(
            f"{self.baseURL}?token={self.conference.token}", {"file": file}
        )
        self.validate_response(request, 400)

    def test_large_file(self):
        file = SimpleUploadedFile(
            "test.pdf",
            BytesIO(b"A" * 40 * 1024 * 1024).getvalue(),
            content_type="application/pdf",
        )
        
        request = self.client.post(
            f"{self.baseURL}?token={self.conference.token}", {"file": file}
        )
        self.validate_response(request, 400)

    def test_request(self):
        file = SimpleUploadedFile(
            "test.pdf",
            self.create_mock_pdf().read(),
            content_type="application/pdf",
        )
        
        with override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True):            
            request = self.client.post(
                f"{self.baseURL}?token={self.conference.token}", {"file": file}
            )
        
        self.validate_response(request, expect_json=True)
        
        json = request.json()
        
        self.assertTrue(json["success"], "Success is supposed to be true.")
        self.assertIsNotNone(json["task_id"], "No celery task id was given.")
        self.assertIsNotNone(json["file_token"], "No file token was given.")
        
        file_path = settings.UPLOAD_DIR / f"processed_documents/{json["file_token"]}"
        
        self.assertTrue(os.path.exists(file_path))
        shutil.rmtree(file_path)