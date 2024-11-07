from django.test import Client, TestCase
from . import models

# Create your tests here.
class TestApi(TestCase):
    def setUp(self):
        self.client = Client()

    def test_api1(self, *args, **kwargs):
        objects = models.TestInformation.objects
        for i in range(50):
            objects.create(name=f"Name{i}", description=f"Description{i}")

        request = self.client.get("/api/testing_api/")

        self.assertIsNotNone(request)
        self.assertEqual(request.status_code, 200)
        self.assertEqual(len(request.json()), 50)