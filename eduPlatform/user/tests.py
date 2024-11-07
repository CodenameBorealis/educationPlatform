from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from json import dumps

# Create your tests here.
class TestLogin(TestCase):
    def setUp(self):
        User = get_user_model()
        User.objects.create_user(username="testinguser", password="testingpassword")
        
        self.client = Client()

    def test_can_access_not_logged_in(self):
        response = self.client.get("/user/login/")

        self.assertIsNotNone(response)
        self.assertTemplateUsed(response, "login.html")
    
    def test_cant_access_logged_in(self):
        logged_in = self.client.login(username="testinguser", password="testingpassword")
        self.assertNotEqual(logged_in, False)

        response = self.client.get("/user/login/")

        self.assertIsNotNone(response)
        self.assertTemplateNotUsed("login.html")
    
    def test_login_post_request(self):
        self.client.logout()
        response = self.client.post("/user/login/", dumps({"username": "testinguser", "password": "testingpassword"}), content_type="json")

        self.assertIsNotNone(response)
        self.assertIsNotNone(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)