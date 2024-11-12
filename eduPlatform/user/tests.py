from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from json import dumps

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
        
class UserTestPfpRequest(TestCase):
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
    
    def test_get_profile_picture_self(self):
        result = self.client.get("/user/get_pfp/?user_id=-1")
        
        self.assertIsNotNone(result.headers, "Returned an empty response.")
        self.assertNotEqual(result.streaming_content, b"", "Response content is empty.")
        
    def test_get_profile_picture_not_logged_in(self):
        self.client.logout()
        result = self.client.get(f"/user/get_pfp/?user_id={self.user_id}")

        self.assertIsNotNone(result.headers, "Returned an empty response.")
        self.assertEqual(result.status_code, 403, "Returned status code must be 403 (Forbidden) because client is not logged in.")

class AuthApiTest(TestCase):
    def setUp(self):
        User = get_user_model()
        user = User.objects.create_testuser()
        
        self.client = Client()
    
    def test_login_post_request(self):
        response = self.client.post("/user/login/", dumps({"username": "test", "password": "test"}), content_type="json")

        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertIsNotNone(response.json(), "Recieved an empty json response.")
        
        self.assertEqual(response.status_code, 200, "Returned code is not 200.")
        self.assertEqual(response.json().get("success"), True, "Json returned success: False. (Attempt unsuccessful)")
        
    def test_login_post_request_wrong_username(self):
        response = self.client.post("/user/login/", dumps({"username": "test_wrong", "password": "test"}), content_type="json")

        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertIsNotNone(response.json(), "Recieved an empty json response.")
        
        self.assertEqual(response.status_code, 200, "Returned code is not 200.")
        self.assertEqual(response.json().get("success"), False, "Json returned success: True, logged in with wrong username.")
        
    def test_login_post_request_wrong_password(self):
        response = self.client.post("/user/login/", dumps({"username": "test", "password": "test_wrong"}), content_type="json")

        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertIsNotNone(response.json(), "Recieved an empty json response.")
        
        self.assertEqual(response.status_code, 200, "Returned code is not 200.")
        self.assertEqual(response.json().get("success"), False, "Json returned success: True, logged in with wrong password.")
    
    def test_logout(self):
        logged_in = self.client.login(username="test", password="test")
        self.assertEqual(logged_in, True, "Failed to log into testing account.")
        
        response = self.client.get("/user/logout/")
        
        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertEqual(response.status_code, 302, "Response code is not 302 (Redirect)")

class UserTestUsernameRequest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_testuser()
        
        self.client = Client()
        
        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")

    def test_can_access_not_logged_in(self):
        self.client.logout()
        
        response = self.client.get("/user/get_username/?user_id=1")
        
        self.assertIsNotNone(response.content, "Recieved an empty response.")
        self.assertEqual(response.status_code, 403, "Status code is not 403 (Forbidden).")

    def get_response(self, user_id):
        response = self.client.get(f"/user/get_username/?user_id={user_id}")

        self.assertIsNotNone(response.content, "Recieved an empty response.")
        self.assertEqual(response.status_code, 200, "Status code is not 200 (Success).")
        
        json = response.json()
         
        self.assertIsNotNone(json, "Returned json response is empty.")
        self.assertTrue(json.get("success"), "Json states that the request was unsuccessful.")
        
        self.assertIsNotNone(json.get("data"), "Json data is empty.")
        self.assertIsNotNone(json.get("data").get("username"), "Json username is none.")
        self.assertIsNotNone(json.get("data").get("user_id"), "Json user_id is none.")
        
        self.assertEqual(json.get("data").get("username"), "test", "Invalid username return.")
        self.assertEqual(json.get("data").get("user_id"), self.user.id, "Invalid user_id return.")
    
    def test_response_self(self):
        self.get_response(-1)
        self.get_response(self.user.id)
    
    def test_response_invalid_id(self):
        with self.assertRaises(AssertionError):
            self.get_response(-2)
        
        with self.assertRaises(AssertionError):
            self.get_response(999)
        