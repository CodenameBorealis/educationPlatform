import json
from channels.db import database_sync_to_async as dsa
from channels.generic.websocket import AsyncWebsocketConsumer

class SignalingConsumer(AsyncWebsocketConsumer):
    def conferenceExists(self, conference_token):
        return self.Conference.objects.filter(token=conference_token).exists()
    
    async def connect(self):
        from .models import Conference
        from django.contrib.auth import get_user_model
        
        self.Conference = Conference
        self.User = get_user_model()
        
        self.room_token = self.scope['url_route']['kwargs']['token']
        self.room_group_name = f'signaling_{self.room_token}'
        
        if not self.scope['user'].is_authenticated:
            await self.close(code=4001)
            return
        
        self.private_group_name = f'private_user{self.scope.get("user").id}'
        
        conferenceExistsAsync = dsa(self.conferenceExists)
        if not await conferenceExistsAsync(self.room_token):
            await self.close(code=4002)
            return
    
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.channel_layer.group_add(
            self.private_group_name,
            self.channel_name
        )
        
        await self.accept()
    
    async def disconnect(self, *args, **kwargs):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        await self.channel_layer.group_discard(
            self.private_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        data = json.loads(text_data)
        
        if data.get("type") == "join":      
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'signaling_message',
                    'message': {
                        'type': 'new-participant',
                        'from': data['userId']
                    }
                }
            )
            
            return
        
        room_group = (
            self.room_group_name
            if not data.get("to")
            else f"private_user{data.get('to')}"
        )
        
        await self.channel_layer.group_send(
            room_group, {
                    'type': 'signaling_message',
                    'message': data
                })
    
    async def signaling_message(self, event):
        message = event.get("message")
        await self.send(text_data=json.dumps(message))