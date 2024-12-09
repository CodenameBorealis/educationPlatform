from django.utils.timezone import now
from channels.layers import get_channel_layer

from celery import shared_task

from asgiref.sync import async_to_sync
from .models import Conference


@shared_task
def end_conference(conference_token):
    conference = Conference.objects.get(token=conference_token)

    conference.ended = True
    conference.end_time = now()
    conference.celery_task_id = None

    conference.save()

    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"signaling_{conference.token}",
        {"type": "signaling_message", "message": {"type": "conference-ended"}},
    )

    async_to_sync(channel_layer.group_send)(
        f"signaling_{conference.token}",
        {"type": "end_conference"},
    )
