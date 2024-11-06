from django.test import TestCase

# Create your tests here.
class ExpTestCase(TestCase):
    def setUp(self) -> None:
        self.testCase = False
    
    def test_case(self):
        assert(self.testCase)