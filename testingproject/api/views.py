from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from . import serializer
from . import models

# Create your views here.

@api_view(["GET"])
def apiTest1(request, *args, **kwargs):
    data = models.TestInformation.objects.all()
    serialized = serializer.DataSerializer(data, many=True)

    return Response(serialized.data)
