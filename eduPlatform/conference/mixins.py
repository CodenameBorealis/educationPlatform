from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, AuthenticationFailed, PermissionDenied

from .models import Conference as ConferenceModel

import rest_framework.status as status



class ConferencePermissionsMixin:
    """
    A mixin that is used to validate user's access to specific conference's API endpoints like get-message-history and etc.
    For the validation to succeed the user must be authenticated, have a token present which is valid and be in the allowed_users list in the conference model.
    """
    
    def validate_request(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            raise AuthenticationFailed("You must be logged in the access this API.")

        token = request.GET.get("token")
        if not token:
            raise ValidationError("No token provided.")

        try:
            conference = ConferenceModel.objects.get(token=token)
        except ConferenceModel.DoesNotExist:
            raise ValidationError("Invalid token provided.")
        
        user_id = request.user.id
        if not conference.allowed_users.filter(id=user_id).exists() and conference.host.id != user_id:
            raise PermissionDenied("You do not have access to this conference.")
        
        return conference