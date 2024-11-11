from django.contrib.auth import get_user_model
from django.test import TestCase, Client

# Create your tests here.

class UserManagersTests(TestCase):
    def test_create_user(self):
        User = get_user_model()
        
        user = User.objects.create_user(username="testing", email="test@abc.com")
        user.set_password("testingpassword")

        self.assertEqual(user.email, "test@abc.com")
        self.assertEqual(user.username, "testing")

        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)
        self.assertTrue(user.is_active)

        with self.assertRaises(TypeError):
            User.objects.create_user()

        with self.assertRaises(TypeError):
            User.objects.create_user(username="")
        
    def test_create_superuser(self):
        User = get_user_model()

        user = User.objects.create_superuser(username="testing", email="test@abc.com")
        user.set_password("testingpassword")

        self.assertEqual(user.email, "test@abc.com")
        self.assertEqual(user.username, "testing")

        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_active)
        
class UserTestRequests(TestCase):
    def setUp(self):
        User = get_user_model()
        
        user = User.objects.create_testuser()
        self.user_id = user.id
        
        self.assertIsNotNone(user)
        
        self.client = Client()
        login_success = self.client.login(username="test", password="test")
        
        self.assertNotEqual(login_success, False, "Failed to log into testing account.")
    
    def test_get_profile_picture_placeholder(self):
        result = self.client.get(f"/user/get_pfp/?user_id={self.user_id}")

        self.assertIsNotNone(result.headers, "Returned an empty response.")
        self.assertNotEqual(result.streaming_content, b"", "Response content is empty.")
        
        self.assertEqual(result.status_code, 200, "Response code is not 200.")
    
    def test_get_profile_picture_not_logged_in(self):
        self.client.logout()
        result = self.client.get(f"/user/get_pfp/?user_id={self.user_id}")

        self.assertIsNotNone(result.headers, "Returned an empty response.")
        self.assertEqual(result.status_code, 403, "Returned status code must be 403 (Forbidden) because client is not logged in.")