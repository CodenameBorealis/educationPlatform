from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import TestCase, Client
from django.core.files.uploadedfile import SimpleUploadedFile

from rest_framework.serializers import ValidationError
from json import dumps
from PIL import Image

import io

# Create your tests here.

class UserManagersTests(TestCase):
    def test_create_user(self):
        User = get_user_model()
        
        user = User.objects.create_user(username="testing", email="test@abc.com", password="testingpassword")

        self.assertEqual(user.email, "test@abc.com")
        self.assertEqual(user.username, "testing")

        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)
        self.assertTrue(user.is_active)

        with self.assertRaises(ValidationError):
            User.objects.create_user()

        with self.assertRaises(ValidationError):
            User.objects.create_user(username="")
        
    def test_create_superuser(self):
        User = get_user_model()
        user = User.objects.create_superuser(username="testing", email="test@abc.com", password="testingpassword")

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
        response = self.client.post("/user/login/", dumps({"username": "test", "password": "test"}), content_type="application/json")

        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertIsNotNone(response.json(), "Recieved an empty json response.")
        
        self.assertEqual(response.status_code, 200, "Returned code is not 200.")
        self.assertEqual(response.json().get("success"), True, "Json returned success: False. (Attempt unsuccessful)")
        
    def test_login_post_request_wrong_username(self):
        response = self.client.post("/user/login/", dumps({"username": "test_wrong", "password": "test"}), content_type="application/json")

        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertIsNotNone(response.json(), "Recieved an empty json response.")
        
        self.assertEqual(response.status_code, 200, "Returned code is not 200.")
        self.assertEqual(response.json().get("success"), False, "Json returned success: True, logged in with wrong username.")
        
    def test_login_post_request_wrong_password(self):
        response = self.client.post("/user/login/", dumps({"username": "test", "password": "test_wrong"}), content_type="application/json")

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
        
class UserTestDataRequest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_testuser()
        
        self.client = Client()
        
        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")

    def test_can_access_not_logged_in(self):
        self.client.logout()
        response = self.client.get("/user/get_userinfo/")
        
        self.assertIsNotNone(response.content, "Recieved an empty response.")
        self.assertEqual(response.status_code, 403, "Code is not 403, you should not be able to access the page without being logged into an account.")
    
    def test_verify_data(self):
        response = self.client.get("/user/get_userinfo/")
        
        self.assertIsNotNone(response.content, "Recieved an empty response.")
        self.assertEqual(response.status_code, 200, "Code is not 200, request unsuccessful.")
        
        json = response.json()
        
        self.assertTrue(json.get("success"), "JSON indicates that request was not successful.")
        self.assertIsNotNone(json.get("data"), "Returned data is none.")
        
        data = json.get("data")
        verify_data = [
            ("user_id", self.user.id),
            ("username", self.user.username),
            ("email", self.user.email),
            ("description", self.user.description),
            ("is_staff", self.user.is_staff),
            ("is_superuser", self.user.is_superuser)
        ]

        for key, expected_value in verify_data:
            self.assertEqual(data.get(key), expected_value, f"Invalid value {key} given.")

class UserTestDescriptionSetRequest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_testuser()
        
        self.client = Client()
        
        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")
    
    def test_access_not_logged_in(self):
        self.client.logout()
        request = self.client.post("/user/set_description/")
        
        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(request.status_code, 403, "Status code is not 403, you should not be able to access the api without being logged in.")
    
    def test_request(self):
        request = self.client.post("/user/set_description/", dumps({"description": "TEST_TEST_TEST"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Got an empty response.")
        self.assertEqual(request.status_code, 200, "Status code not 200, API call failed.")
        
        self.assertIsNotNone(request.json(), "Got an empty JSON response")
        json = request.json()
        
        self.assertIsNotNone(json.get("success"), "JSON does not contain success key.")
        self.assertTrue(json.get("success"), "JSON success is false.")
        
        usr = get_user_model().objects.get(id=self.user.id)
        
        self.assertEqual(usr.description, "TEST_TEST_TEST", "API failed to set user description.")
    
    def test_request_empty(self):
        request = self.client.post("/user/set_description/", content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 400, "Code is not 400 (Bad request)")

class UserTestUsernameSetRequest(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.user = self.User.objects.create_testuser()
        
        self.client = Client()
        
        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")
    
    def test_can_access_not_logged_in(self):
        self.client.logout()
        request = self.client.post("/user/set_username/", dumps({"username": "test", "password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 403, "Status code is not 403.")
        
    def test_request(self):
        request = self.client.post("/user/set_username/", dumps({"username": "test2", "password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Status code is not 200.")
        
        self.assertJSONEqual(request.content.decode("utf-8"), {"success": True, "error_message": ""}, "JSON response does not match.")
    
    def test_request_exists(self):
        self.User.objects.create_user(username="testing_user", password="abcabc", email="email@email.com")
        request = self.client.post("/user/set_username/", dumps({"username": "testing_user", "password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Status code is not 200.")
        
        self.assertIsNotNone(request.json(), "JSON response is empty")
        self.assertFalse(request.json().get("success"), "Request was successful for an already existing username.")
    
    def test_request_invalid_password(self):
        request = self.client.post("/user/set_username/", dumps({"username": "testing_user", "password": "test_invalid"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Status code is not 200.")
        
        self.assertIsNotNone(request.json(), "JSON response is empty")
        self.assertFalse(request.json().get("success"), "Request was successful for an invalid password.")
        
    def test_request_long_username(self):
        request = self.client.post("/user/set_username/", dumps({"username": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789s", "password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Status code is not 200.")
        
        self.assertIsNotNone(request.json(), "Request JSON is missing.")
        self.assertEqual(request.json().get("success"), False, "Successfully set username with over 50 characters.")

class UserTestProfileChangeRequest(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.user = self.User.objects.create_testuser()
        
        self.client = Client()
        self.client.login(username='test', password='test')
        
        self.upload_path = settings.BASE_DIR / "uploads/profile_pictures"
    
    def tearDown(self):
        for file in self.upload_path.glob('*'):
            if "profile_picture_" in file.name:
                file.unlink()

    def generate_test_image(self):
        with open(settings.BASE_DIR / "uploads/profile_pictures/Pfp_default.png", "rb") as img:
            return SimpleUploadedFile(
                "Pfp_default.png",
                img.read(),
                content_type="image/png"
            )

    def test_upload_valid_profile_picture(self):
        img_bytes = self.generate_test_image()
        response = self.client.post('/user/change_profile_picture/', {'image': img_bytes}, format='multipart')

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {
            "success": True,
            "error_message": ""
        })

        profile_picture_path = self.upload_path / f"profile_picture_{self.user.id}.jpg"
        self.assertEqual(self.User.objects.get(id=self.user.id).profile_picture, f"profile_picture_{self.user.id}.jpg")

    def test_upload_invalid_file_type(self):
        img_bytes = io.BytesIO(b'NotAnImage')
        response = self.client.post('/user/change_profile_picture/', {'image': img_bytes}, format='multipart')

        self.assertEqual(response.status_code, 200)
        self.assertIn("success", response.json())
        self.assertFalse(response.json()["success"])

    def test_upload_unauthenticated_user(self):
        self.client.logout()
        img_bytes = self.generate_test_image()
        response = self.client.post('/user/change_profile_picture/', {'image': img_bytes}, format='multipart')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.content.decode(), "You must be logged in to access this API.")

class UserTestPasswordChangeRequest(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.user = self.User.objects.create_testuser()
        
        self.client = Client()
        
        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")
    
    def test_access_not_logged_in(self):
        self.client.logout()
        request = self.client.post("/user/set_password/", dumps({"new_password": "test2", "old_password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 403, "You shouldn't be able to access the API without being logged into an account.")
    
    def test_request(self):
        request = self.client.post("/user/set_password/", dumps({"new_password": "test2", "old_password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Response code is not 200.")
        
        self.assertJSONEqual(request.content.decode(), {"success": True, "error_message": ""}, "Invalid JSON response given.")
        self.assertTrue(self.User.objects.get(username="test").check_password("test2"), "Password has not been changed.")
        
    def test_request_invalid(self):
        request = self.client.post("/user/set_password/", dumps({"new_password": "t est2", "old_password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Response code is not 200.")
        
        self.assertFalse(request.json().get("success"), "Successfully set an incorrect password.")
    
    def test_request_duplicate(self):
        request = self.client.post("/user/set_password/", dumps({"new_password": "test", "old_password": "test"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Response code is not 200.")
        
        self.assertFalse(request.json().get("success"), "Successfully set a duplicate password.")

class UserTestEmailChangeRequest(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.user = self.User.objects.create_testuser()
        
        self.client = Client()
        
        logged_in = self.client.login(username="test", password="test")
        self.assertTrue(logged_in, "Failed to log into testing account.")
    
    def test_not_authorized(self):
        self.client.logout()
        request = self.client.post("/user/set_email/")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 403, "You shouldn't be able to access this API without being logged in.")
    
    def test_request(self):
        request = self.client.post("/user/set_email/", dumps({"password": "test", "email": "test2@test.com"}), content_type="application/json")
        
        self.assertIsNotNone(request.headers, "Recieved an empty response.")
        self.assertEqual(request.status_code, 200, "Status code is not 200.")
        
        self.assertJSONEqual(request.content.decode(), {"success": True, "error_message": ""}, "Invalid JSON response.")
        self.assertEqual(self.User.objects.get(id=self.user.id).email, "test2@test.com", "Email has been left intact.")
        
    def test_invalid_request(self):
        def _check_request(request):
            self.assertIsNotNone(request.headers, "Recieved an empty response.")
            self.assertEqual(request.status_code, 200, "Status code is not 200.")
            
            self.assertEqual(request.json().get("success"), False, "Invalid request was successful.")
            
        _check_request(self.client.post("/user/set_email/", dumps({"password": "test", "email": "test 2@test.com"}), content_type="application/json"))
        _check_request(self.client.post("/user/set_email/", dumps({"password": "test", "email": "test@test.com"}), content_type="application/json"))
        