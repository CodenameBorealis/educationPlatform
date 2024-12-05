import json

from datetime import datetime
from channels.db import database_sync_to_async as dsa
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache


class SignalingConsumer(AsyncWebsocketConsumer):
    def conference_exists(self, conference_token):
        return self.Conference.objects.filter(token=conference_token).exists()

    def get_conference(self, conference_token):
        return self.Conference.objects.get(token=conference_token)

    def get_conference_host_id(self, conference_token):
        return self.get_conference(conference_token).host.id

    def user_allowed(self, conference_token, user_id):
        conference = self.get_conference(conference_token)
        return conference.allowed_users.filter(id=user_id).exists()

    # Conference variables
    activeUsers = set()

    # Screen share state variables
    isScreenSharing = False
    screenShareUserID = -1

    # Co-Host information variables
    coHostList = set()

    async def connect(self):
        if not self.scope[
            "user"
        ].is_authenticated:  # Restrict access if user is not authenticated
            await self.close(code=4001)
            return

        # Load main libraries here because if you do that outside it's gonna error out and I have no clue on how to fix it
        from .models import Conference
        from django.contrib.auth import get_user_model

        self.Conference = Conference
        self.User = get_user_model()

        self.user_id = self.scope["user"].id

        # Store information about the room the user is currently in
        self.room_token = self.scope["url_route"]["kwargs"]["token"]

        self.room_group_name = f"signaling_{self.room_token}"
        self.private_group_name = f"private_user{self.user_id}"

        # Check if the conference with this token exists
        if not await dsa(self.conference_exists)(self.room_token):
            await self.close(code=4001)
            return

        # Get the conference model
        self.conference = await dsa(self.get_conference)(self.room_token)
        self.host_id = await dsa(self.get_conference_host_id)(self.room_token)

        # Check if the user is in the allowed_users lists
        if (
            not await dsa(self.user_allowed)(self.room_token, self.user_id)
            and self.user_id != self.host_id
        ):
            await self.close(code=4003)
            return

        # Save the cache key for message history and if the cache doesn't exist, start a new empty cache
        self.message_history_cache_key = f"conference_message_cache_{self.room_token}"
        if not cache.get(self.message_history_cache_key):
            cache.set(self.message_history_cache_key, [], timeout=86400)

        # A hashmap containing all the signal types that are handled by a seperate method (usually rule-enforced types like 'add-cohost' or 'start-screenshare')
        self.TYPE_HANDLERS = {
            "global-message": self.handle_global_chat_message,
            "start-screenshare": self.start_screenshare,
            "stop-screenshare": self.stop_screenshare,
            "add-cohost": self.add_cohost,
            "remove-cohost": self.remove_cohost,
        }

        self.activeUsers.add(self.user_id)

        # If everything checks out, add user to the group channels and accept the websocket connection
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.channel_layer.group_add(self.private_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, *args, **kwargs):
        # An additional check if the user is disconnecting and was sharing their screen, call stop_screenshare and pass in a mockup data input
        if self.user_id == self.screenShareUserID and self.isScreenSharing:
            await self.stop_screenshare(
                {"from": self.user_id, "type": "stop-screenshare"}
            )

        # If the user was a cohost before disconnecting, mockup a data input as host and remove the user from the cohosts list
        if self.user_id in self.coHostList:
            await self.remove_cohost(
                {
                    "from": self.host_id,
                    "type": "remove-cohost",
                    "to": self.user_id,
                }
            )

        if self.user_id in self.activeUsers:
            self.activeUsers.remove(self.user_id)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signaling_message",
                "message": {"type": "disconnect", "from": self.user_id},
            },
        )

        # Remove user from the existing group channels
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        await self.channel_layer.group_discard(
            self.private_group_name, self.channel_name
        )

    async def add_cohost(self, data):
        # An async function used as an override for 'add-cohost' signal type

        # Validate user permissions and check whether they are already a co-host
        if data.get("from") != self.host_id or data.get("to") in self.coHostList:
            return

        # If user is not in the conference, ignore the request
        if data.get("to") not in self.activeUsers:
            return

        # If the user is the host, ignore request
        if data.get("to") == self.host_id:
            return

        self.coHostList.add(data.get("to"))

        await self.channel_layer.group_send(
            f"private_user{data.get('to')}",
            {"type": "signaling_message", "message": data},
        )

    async def remove_cohost(self, data):
        # An async function used as an override for 'remove-cohost' signal type

        # Validate permissions and check whether they actually exist in the cohost set
        if data.get("from") != self.host_id or data.get("to") not in self.coHostList:
            return

        target = data.get("to")

        # If the user is the host, ignore request
        if target == self.host_id:
            return

        self.coHostList.remove(target)

        # If the user was sharing their screen, stop it
        if self.isScreenSharing and self.screenShareUserID == target:
            await self.stop_screenshare({"from": target, "type": "stop-screenshare"})

        await self.channel_layer.group_send(
            f"private_user{target}",
            {"type": "signaling_message", "message": data},
        )

    async def handle_global_chat_message(self, data):
        # An async function used as an override for 'global-message' signal type

        # Get current time and convert it to iso format for reginal sync
        now = datetime.now()
        timestamp = now.isoformat()

        data["timestamp"] = timestamp

        # Save the message to the message history cache
        message_history = cache.get(self.message_history_cache_key, [])
        message_history.append(
            {
                "user_id": data.get("from"),
                "username": self.scope["user"].username,
                "content": data.get("content"),
                "timestamp": data.get("timestamp"),
            }
        )

        cache.set(self.message_history_cache_key, message_history, timeout=86400)

        # Send the message and it's data to other users
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signaling_message",
                "username": self.scope.get("user").username,
                "message": data,
            },
        )

    async def start_screenshare(self, data):
        # Async function used as an override for 'start-screenshare' signal type

        # Check user permissions (Don't worry about data.get("from"), it was set by the backend server in receive function)
        if self.host_id != data.get("from") and data.get("from") not in self.coHostList:
            return

        """
        If the screen if being shared, ignore request to avoid duplicates
        "data.get("to")" is used in case a user joins the conference while someone's already sharing their screen,
        so the host can get the start-screenshare through just for that specific user
        """
        if self.isScreenSharing and not (
            data.get("to") and data.get("from") == self.screenShareUserID
        ):
            return

        # Set the screenshare status to true and save the sharing user's ID
        self.isScreenSharing = True
        self.screenShareUserID = data.get("from")

        await self.channel_layer.group_send(
            self.room_group_name, {"type": "signaling_message", "message": data}
        )

    async def stop_screenshare(self, data):
        # Async function used as an override for 'stop-screenshare' signal type

        # If no screenshare is taking place, just ignore the request
        if not self.isScreenSharing:
            return

        # If the user who requested the screenshare to stop isn't the original user who started it, ignore the request.
        if data.get("from") != self.screenShareUserID:
            return

        # Reset the screenshare attributes
        self.isScreenSharing = False
        self.screenShareUserID = -1

        await self.channel_layer.group_send(
            self.room_group_name, {"type": "signaling_message", "message": data}
        )

    async def receive(self, text_data):
        # Async function used for handling data received from the clients

        # Load the data and for security measures to not let impersonation take place, override 'from' field
        data = json.loads(text_data)
        data["from"] = self.scope["user"].id

        # If type is not specified, then return
        if not data.get("type"):
            return

        # If the 'type' of the signal is one of the rule-enforced methods or requires special handling, send it to a dedicated handler
        type = data.get("type")
        if type in self.TYPE_HANDLERS:
            await self.TYPE_HANDLERS[type](data)
            return

        # If data doesn't have a field 'to', this is a global message and it will be sent to everyone, otherwise a private channel will be used.
        room_group = (
            self.room_group_name
            if not data.get("to")
            else f"private_user{data.get('to')}"
        )

        await self.channel_layer.group_send(
            room_group, {"type": "signaling_message", "message": data}
        )

    async def signaling_message(self, event):
        # Async function used for "json'ifying the data and sending it to the client"
        message = event.get("message")
        await self.send(text_data=json.dumps(message))
