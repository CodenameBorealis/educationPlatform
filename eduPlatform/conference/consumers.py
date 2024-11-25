import json

from datetime import datetime
from channels.db import database_sync_to_async as dsa
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache

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
        
        self.message_history_cache_key = f"conference_message_cache_{self.room_token}"
        if not cache.get(self.message_history_cache_key):
            cache.set(self.message_history_cache_key, [], timeout=86400)
        
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
        data["from"] = self.scope["user"].id
        
        if data.get("type") == "join":      
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'signaling_message',
                    'message': {
                        'type': 'new-participant',
                        'from': data['from']
                    }
                }
            )
            
            return

        if data.get("type") == "global-message":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "username": self.scope.get("user").username,
                    "message": data
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
        
    async def chat_message(self, event):
        message_data = event.get("message")
        
        now = datetime.now()
        timestamp = now.isoformat()
        
        message_data["timestamp"] = timestamp
        
        message_history = cache.get(self.message_history_cache_key, [])
        message_history.append({
            'user_id': message_data.get("from"),
            'username': event.get("username"),
            'content': message_data.get("content"),
            'timestamp': message_data.get("timestamp")
        })
        
        cache.set(self.message_history_cache_key, message_history, timeout=86400)
        
        await self.send(text_data=json.dumps(message_data))