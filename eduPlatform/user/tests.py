from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import TestCase, Client
from django.core.files.uploadedfile import SimpleUploadedFile

from rest_framework.serializers import ValidationError
from json import dumps
from PIL import Image

from unittest import SkipTest

import io


class BaseUserTest(TestCase):
    """
    An abstraction class for tests that contains all the repetitively
    used functions like validate_response in one place for easier maintainability
    """

    baseURL = ""
    requestType = "POST"
    requiresAuthTest = True
    
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        if cls is BaseUserTest:
            raise SkipTest("BaseUserTest is an abstract test class and should not run directly.")

    def set_up_client(self):
        self.User = get_user_model()

        self.user = self.User.objects.create_testuser()
        self.user_id = self.user.id

        self.assertIsNotNone(self.user)

        self.client = Client()
        login_success = self.client.login(username="test", password="test")

        self.assertNotEqual(login_success, False, "Failed to log into testing account.")

    def validate_response(self, response, expected_code=200, expect_json=False):
        self.assertIsNotNone(response.headers, "Recieved an empty response.")
        self.assertEqual(
            response.status_code,
            expected_code,
            f"Returned code is not {expected_code}.",
        )

        if expect_json:
            self.assertIsNotNone(response.json(), "Expected JSON response.")

    def test_can_access_not_logged_in(self):
        if self.baseURL == "":
            raise NotImplementedError("baseURL must be set.")
        
        if not self.requiresAuthTest:
            return

        self.client.logout()
        response = self.client.get(self.baseURL) if self.requestType == "GET" else self.client.post(self.baseURL)

        self.validate_response(response, expected_code=403)


class UserManagersTests(TestCase):
    def test_create_user(self):
        User = get_user_model()

        user = User.objects.create_user(
            username="testing", email="test@abc.com", password="testingpassword"
        )

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
        user = User.objects.create_superuser(
            username="testing", email="test@abc.com", password="testingpassword"
        )

        self.assertEqual(user.email, "test@abc.com")
        self.assertEqual(user.username, "testing")

        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_active)


class UserTestPfpRequest(BaseUserTest):
    baseURL = "/user/get_pfp/"
    requestType = "GET"

    def setUp(self):
        self.set_up_client()

    def test_get_profile_picture_placeholder(self):
        result = self.client.get(f"{self.baseURL}?user_id={self.user_id}")

        self.validate_response(result)
        self.assertNotEqual(result.streaming_content, b"", "Response content is empty.")

    def test_get_profile_picture_self(self):
        result = self.client.get(f"{self.baseURL}?user_id=-1")

        self.validate_response(result)
        self.assertNotEqual(result.streaming_content, b"", "Response content is empty.")


class AuthApiTest(BaseUserTest):
    baseURL = "/user/login/"
    logoutURL = "/user/logout/"

    requiresAuthTest = False

    def setUp(self):
        self.set_up_client()

    def test_login_post_request(self):
        response = self.client.post(
            self.baseURL,
            dumps({"username": "test", "password": "test"}),
            content_type="application/json",
        )

        self.validate_response(response, expect_json=True)
        self.assertEqual(
            response.json().get("success"),
            True,
            "Json returned success: False. (Attempt unsuccessful)",
        )

    def test_login_post_request_wrong_username(self):
        response = self.client.post(
            self.baseURL,
            dumps({"username": "test_wrong", "password": "test"}),
            content_type="application/json",
        )

        self.validate_response(response, expect_json=True)
        self.assertEqual(
            response.json().get("success"),
            False,
            "Json returned success: True, logged in with wrong username.",
        )

    def test_login_post_request_wrong_password(self):
        response = self.client.post(
            self.baseURL,
            dumps({"username": "test", "password": "test_wrong"}),
            content_type="application/json",
        )

        self.validate_response(response, expect_json=True)
        self.assertEqual(
            response.json().get("success"),
            False,
            "Json returned success: True, logged in with wrong password.",
        )

    def test_logout(self):
        logged_in = self.client.login(username="test", password="test")
        self.assertEqual(logged_in, True, "Failed to log into testing account.")

        response = self.client.get(self.logoutURL)
        self.validate_response(response, expected_code=302)


class UserTestUsernameRequest(BaseUserTest):
    baseURL = "/user/get_username/"
    requestType = "GET"

    def setUp(self):
        self.set_up_client()

    def get_response(self, user_id):
        response = self.client.get(f"{self.baseURL}?user_id={user_id}")
        self.validate_response(response, expect_json=True)

        json = response.json()

        self.assertTrue(
            json.get("success"), "Json states that the request was unsuccessful."
        )

        self.assertIsNotNone(json.get("data"), "Json data is empty.")
        self.assertIsNotNone(json.get("data").get("username"), "Json username is none.")
        self.assertIsNotNone(json.get("data").get("user_id"), "Json user_id is none.")

        self.assertEqual(
            json.get("data").get("username"), "test", "Invalid username return."
        )
        self.assertEqual(
            json.get("data").get("user_id"), self.user.id, "Invalid user_id return."
        )

    def test_response_self(self):
        self.get_response(-1)
        self.get_response(self.user.id)

    def test_response_invalid_id(self):
        with self.assertRaises(AssertionError):
            self.get_response(-2)

        with self.assertRaises(AssertionError):
            self.get_response(999)


class UserTestDataRequest(BaseUserTest):
    baseURL = "/user/get_userinfo/"
    requestType = "GET"

    def setUp(self):
        self.set_up_client()

    def test_verify_data(self):
        response = self.client.get(self.baseURL)
        self.validate_response(response, expect_json=True)

        json = response.json()

        self.assertTrue(
            json.get("success"), "JSON indicates that request was not successful."
        )
        self.assertIsNotNone(json.get("data"), "Returned data is none.")

        data = json.get("data")
        verify_data = [
            ("user_id", self.user.id),
            ("username", self.user.username),
            ("email", self.user.email),
            ("description", self.user.description),
            ("is_staff", self.user.is_staff),
            ("is_superuser", self.user.is_superuser),
        ]

        for key, expected_value in verify_data:
            self.assertEqual(
                data.get(key), expected_value, f"Invalid value {key} given."
            )


class UserTestDescriptionSetRequest(BaseUserTest):
    baseURL = "/user/set_description/"

    def setUp(self):
        self.set_up_client()

    def test_request(self):
        request = self.client.post(
            self.baseURL,
            dumps({"description": "TEST_TEST_TEST"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        json = request.json()
        self.assertTrue(json.get("success"), "JSON success is false.")

        usr = get_user_model().objects.get(id=self.user.id)
        self.assertEqual(
            usr.description, "TEST_TEST_TEST", "API failed to set user description."
        )

    def test_request_large(self):
        request = self.client.post(
            self.baseURL,
            dumps({"description": "A" * 10000}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        json = request.json()
        self.assertEqual(
            json.get("success"), False, "JSON is either not present or is True."
        )

    def test_request_empty(self):
        request = self.client.post(self.baseURL, content_type="application/json")
        self.validate_response(request, expected_code=400)


class UserTestUsernameSetRequest(BaseUserTest):
    baseURL = "/user/set_username/"

    def setUp(self):
        self.set_up_client()

    def test_can_access_not_logged_in(self):
        self.client.logout()
        request = self.client.post(
            self.baseURL,
            dumps({"username": "test", "password": "test"}),
            content_type="application/json",
        )

    def test_request(self):
        request = self.client.post(
            self.baseURL,
            dumps({"username": "test2", "password": "test"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        self.assertJSONEqual(
            request.content.decode("utf-8"),
            {"success": True, "error_message": ""},
            "JSON response does not match.",
        )

    def test_request_exists(self):
        self.User.objects.create_user(
            username="testing_user", password="abcabc", email="email@email.com"
        )

        request = self.client.post(
            self.baseURL,
            dumps({"username": "testing_user", "password": "test"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        self.assertFalse(
            request.json().get("success"),
            "Request was successful for an already existing username.",
        )

    def test_request_invalid_password(self):
        request = self.client.post(
            self.baseURL,
            dumps({"username": "testing_user", "password": "test_invalid"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        self.assertFalse(
            request.json().get("success"),
            "Request was successful for an invalid password.",
        )

    def test_request_long_username(self):
        request = self.client.post(
            self.baseURL,
            dumps({"username": "a" * 10000, "password": "test"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        self.assertEqual(
            request.json().get("success"),
            False,
            "Successfully set username with over 50 characters.",
        )


class UserTestProfileChangeRequest(BaseUserTest):
    baseURL = "/user/change_profile_picture/"
    uploadPath = settings.UPLOAD_DIR / "profile_pictures"

    def setUp(self):
        self.set_up_client()

    def tearDown(self):
        for file in self.uploadPath.glob("*"):
            if "profile_picture_" in file.name:
                file.unlink()

    def generate_test_image(self):
        with open(settings.STATIC_ROOT / "user/Pfp_default.png", "rb") as img:
            return SimpleUploadedFile(
                "Pfp_default.png", img.read(), content_type="image/png"
            )

    def test_upload_valid_profile_picture(self):
        img_bytes = self.generate_test_image()

        response = self.client.post(
            self.baseURL, {"image": img_bytes}, format="multipart"
        )
        self.validate_response(response, expect_json=True)

        self.assertJSONEqual(response.content, {"success": True, "error_message": ""})

        self.assertEqual(
            self.User.objects.get(id=self.user.id).profile_picture,
            f"profile_picture_{self.user.id}.jpg",
        )

    def test_upload_invalid_file_type(self):
        img_bytes = io.BytesIO(b"NotAnImage")

        response = self.client.post(
            self.baseURL, {"image": img_bytes}, format="multipart"
        )
        self.validate_response(response, expect_json=True)

        self.assertFalse(response.json().get("success"))


class UserTestPasswordChangeRequest(BaseUserTest):
    baseURL = "/user/set_password/"

    def setUp(self):
        self.set_up_client()

    def test_request(self):
        request = self.client.post(
            self.baseURL,
            dumps({"new_password": "test2", "old_password": "test"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        self.assertJSONEqual(
            request.content.decode(),
            {"success": True, "error_message": ""},
            "Invalid JSON response given.",
        )
        self.assertTrue(
            self.User.objects.get(username="test").check_password("test2"),
            "Password has not been changed.",
        )

    def test_request_invalid(self):
        request = self.client.post(
            self.baseURL,
            dumps({"new_password": "t est2", "old_password": "test"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        self.assertFalse(
            request.json().get("success"), "Successfully set an incorrect password."
        )

    def test_request_duplicate(self):
        request = self.client.post(
            self.baseURL,
            dumps({"new_password": "test", "old_password": "test"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)
        
        self.assertFalse(
            request.json().get("success"), "Successfully set a duplicate password."
        )


class UserTestEmailChangeRequest(BaseUserTest):
    baseURL = "/user/set_email/"
    
    def setUp(self):
        self.set_up_client()

    def test_request(self):
        request = self.client.post(
            "/user/set_email/",
            dumps({"password": "test", "email": "test2@test.com"}),
            content_type="application/json",
        )
        self.validate_response(request, expect_json=True)

        self.assertJSONEqual(
            request.content.decode(),
            {"success": True, "error_message": ""},
            "Invalid JSON response.",
        )
        self.assertEqual(
            self.User.objects.get(id=self.user.id).email,
            "test2@test.com",
            "Email has been left intact.",
        )

    def test_invalid_request(self):
        def _check_request(request):
            self.validate_response(request, expect_json=True)
            
            self.assertEqual(
                request.json().get("success"), False, "Invalid JSON response."
            )

        _check_request(
            self.client.post(
                "/user/set_email/",
                dumps({"password": "test", "email": "test 2@test.com"}),
                content_type="application/json",
            )
        )
        _check_request(
            self.client.post(
                "/user/set_email/",
                dumps({"password": "test", "email": "test@test.com"}),
                content_type="application/json",
            )
        )
