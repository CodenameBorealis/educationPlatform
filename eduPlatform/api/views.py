from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from . import serializer
from . import models

# This is an unused and unmaintened section of the code which was used for rest_framework testing

@api_view(["GET"])
def apiTest1(request, *args, **kwargs):
    data = models.TestInformation.objects.all()
    serialized = serializer.DataSerializer(data, many=True)

    return Response(serialized.data)
