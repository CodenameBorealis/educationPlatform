from django.test import TestCase, Client
from django.contrib.auth import get_user_model

from json import dumps

class TestHomePage(TestCase):
    def setUp(self):
        User = get_user_model()
        User.objects.create_user(username='testuser', password='12345')

        self.client = Client()
        logged_in = self.client.login(username='testuser', password='12345')

        self.assertNotEqual(logged_in, False)

    def test_homepage_url_exists_at_desired_location(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
    
    def test_homepage_corresponds_to_template(self):
        response = self.client.get("/")
        self.assertTemplateUsed(response, "home.html")

    def test_homepage_accessible_with_no_login(self):
        self.client.logout()
        
        response = self.client.get("/")
        self.assertTemplateNotUsed(response, "home.html")

class TestLogin(TestCase):
    def setUp(self):
        User = get_user_model()
        User.objects.create_user(username="testinguser", password="testingpassword")
        
        self.client = Client()

    def test_can_access_not_logged_in(self):
        response = self.client.get("/login/")

        self.assertIsNotNone(response)
        self.assertTemplateUsed(response, "login.html")
    
    def test_cant_access_logged_in(self):
        logged_in = self.client.login(username="testinguser", password="testingpassword")
        self.assertNotEqual(logged_in, False)

        response = self.client.get("/login/")

        self.assertIsNotNone(response)
        self.assertTemplateNotUsed("login.html")
    
    def test_login_post_request(self):
        self.client.logout()
        response = self.client.post("/login/", dumps({"username": "testinguser", "password": "testingpassword"}), content_type="json")

        self.assertIsNotNone(response)
        self.assertIsNotNone(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)