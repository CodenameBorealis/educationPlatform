from django.test import TestCase, Client
from django.contrib.auth import get_user_model

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
