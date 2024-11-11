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

        self.assertIsNotNone(request.headers, "Returned an empty response.")
        self.assertEqual(request.status_code, 200, "Returned status code is not 200.")
        self.assertEqual(len(request.json()), 50, "Returned data length does not match the initial length of the created data.")