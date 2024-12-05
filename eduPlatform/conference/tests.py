from django.test import Client, TestCase
from django.contrib.auth import get_user_model

from channels.testing import WebsocketCommunicator
from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async as dsa
from channels.layers import get_channel_layer

from asyncio import TimeoutError

from eduPlatform.asgi import application
from .consumers import SignalingConsumer
from .models import Conference


class SignalingConsumerTest(TestCase):
    async def asyncSetUp(self):
        self.User = get_user_model()
        self.user = await dsa(self.User.objects.create_testuser)()
        self.user.set_password("test")
        await dsa(self.user.save)()

        self.conference = await dsa(Conference.objects.create)(host=self.user)
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
            user = await dsa(self.User.objects.create)(username=str(id), password="test", email=f"test{id}@test.c")
            
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


class MessageHistoryTest(TestCase):
    def setUp(self):
        self.mainURL = "/conference/api/get-message-history/"

        User = get_user_model()
        self.user = User.objects.create_testuser()

        self.client = Client()

        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")

        self.conference = Conference.objects.create(host=self.user)
        self.conference.save()

    def test_unauthorized(self):
        self.client.logout()
        request = self.client.get(f"{self.mainURL}?token=something")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(
            request.status_code,
            403,
            "You shouldn't be able to access this API unauthorized.",
        )

    def test_request(self):
        request = self.client.get(f"{self.mainURL}?token={self.conference.token}")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(request.status_code, 200, "Got an invalid status code.")

        json = request.json()

        self.assertIsNotNone(json, "Got an empty JSON response.")

        self.assertTrue(json.get("success"), "JSON success is False.")
        self.assertIsNotNone(json.get("history"), "Missing history field.")

    def test_request_invalid_token(self):
        request = self.client.get(f"{self.mainURL}?token=some-invalid-token")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(request.status_code, 400, "Invalid status code given.")

    def test_request_no_token(self):
        request = self.client.get(f"{self.mainURL}")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(request.status_code, 400, "Invalid status code given.")


class GetMeetingInfoTest(TestCase):
    def setUp(self):
        self.mainURL = "/conference/api/get-data/"

        User = get_user_model()
        self.user = User.objects.create_testuser()

        self.client = Client()

        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")

        self.conference = Conference.objects.create(host=self.user)
        self.conference.save()

    def test_unauthorized(self):
        self.client.logout()
        request = self.client.get(f"{self.mainURL}?token=something")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(
            request.status_code,
            403,
            "You shouldn't be able to access this API unauthorized.",
        )

    def test_request(self):
        request = self.client.get(f"{self.mainURL}?token={self.conference.token}")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(
            request.status_code, 200, "Request returned an invalid response code."
        )

        json = request.json()

        self.assertIsNotNone(json, "JSON response missing.")
        self.assertTrue(json.get("success"), "JSON success is False.")
        self.assertEqual(
            json.get("host"), self.conference.host.id, "Invalid host ID given."
        )
        self.assertEqual(
            json.get("name"), self.conference.name, "Invalid meeting name given."
        )

    def test_invalid(self):
        request = self.client.get(f"{self.mainURL}?token=totally_invalid")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(
            request.status_code, 400, "Request returned an invalid response code."
        )

    def test_missing(self):
        request = self.client.get(f"{self.mainURL}")

        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(
            request.status_code, 400, "Request returned an invalid response code."
        )
