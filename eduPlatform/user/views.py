from django.shortcuts import render
from django.views import View
from django.contrib.auth import authenticate, login
from django.shortcuts import redirect
from django.http import JsonResponse, HttpResponseBadRequest

import json
# Create your views here.

