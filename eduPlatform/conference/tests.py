from django.test import TestCase
from django.contrib.auth import get_user_model
from channels.testing import WebsocketCommunicator
from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async as dsa
from channels.layers import get_channel_layer

from .consumers import SignalingConsumer
from eduPlatform.asgi import application
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
        
        self.assertEqual(self.communicator.scope["user"].username, "test", "Invalid scope user username")
    
    async def tearDown(self):
        await self.communicator.disconnect()
    
    async def test_unauthorized(self):
        await self.asyncSetUp()
        
        communicator = WebsocketCommunicator(
            AuthMiddlewareStack(application), f"/ws/signaling/{self.conference.token}/"
        )
        
        connected, _ = await communicator.connect() 
        
        self.assertFalse(connected, "Connected without proper authentication.")
    
        await self.tearDown()
    
    async def test_data_signaling(self):
        await self.asyncSetUp()
        
        channel_layer = get_channel_layer()
        group = f"signaling_{self.conference.token}"

        await channel_layer.group_send(
            group, {
                "type": "signaling_message",
                "message": {
                    "type": "join",
                    "userId": str(self.user.id),
                }
            }
        )
        
        response = await self.communicator.receive_json_from(timeout=5)
        
        self.assertEqual(response, {"type": "join", "userId": str(self.user.id)}, "Got an invalid JSON response")
    
        await self.tearDown()
    
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
            }
        }
        
        await channel_layer.group_send(
            group, data
        )
        
        response = await self.communicator.receive_json_from(timeout=5)
        
        self.assertEqual(response, {
            "type": "test_signal",
            "to": str(self.user.id),
            "from": str(self.user.id),
        }, "Got invalid JSON response.")
        
        await self.tearDown()