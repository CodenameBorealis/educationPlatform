from django.test import TestCase, Client
from django.contrib.auth import get_user_model

from json import dumps

class TestHomePage(TestCase):
    def setUp(self):
        User = get_user_model()
        User.objects.create_testuser()

        self.client = Client()
        logged_in = self.client.login(username='test', password='test')

        self.assertNotEqual(logged_in, False, "Failed to log into a testing account.")

    def test_homepage_url_exists_at_desired_location(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200, "Returned status code is not 200.")
    
    def test_homepage_corresponds_to_template(self):
        response = self.client.get("/")
        self.assertTemplateUsed(response, "home.html", "A wrong template was used while rendering the web page.")

    def test_homepage_accessible_with_no_login(self):
        self.client.logout()
        
        response = self.client.get("/")
        self.assertTemplateNotUsed(response, "home.html", "A wrong template was used while rendering the web page.")

class TestLogin(TestCase):
    def setUp(self):
        User = get_user_model()
        User.objects.create_testuser()
        
        self.client = Client()

    def test_can_access_not_logged_in(self):
        response = self.client.get("/login/")

        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertTemplateUsed(response, "user/login.html", "A wrong template was used while rendering the web page.")
    
    def test_cant_access_logged_in(self):
        logged_in = self.client.login(username="test", password="test")
        self.assertNotEqual(logged_in, False, "Failed to log into a testing account.")

        response = self.client.get("/login/")

        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertTemplateNotUsed(response, "user/login.html", "A wrong template was used while rendering the web page.")

class TestProfileSettings(TestCase):
    def setUp(self):
        User = get_user_model()
        User.objects.create_testuser()
        
        self.client = Client()
        self.client.login(username="test", password="test")
    
    def test_response(self):
        response = self.client.get("/profile_settings/")
        
        self.assertIsNotNone(response.headers, "Returned an empty response.")
        self.assertEqual(response.status_code, 200, "Status code is not 200 (Success).")
        self.assertTemplateUsed(response, "user/profile_settings.html", "Used a wrong template when rendering request.")
    
    def test_response_not_logged_in(self):
        self.client.logout()
        response = self.client.get("/profile_settings/")
        
        self.assertIsNotNone(response.headers, "Returned an empty response.")
        self.assertEqual(response.status_code, 302, "Status code is not 302 (Redirect).")
        self.assertTemplateNotUsed(response, "user/profile_settings.html", "Used a wrong template when rendering request.")