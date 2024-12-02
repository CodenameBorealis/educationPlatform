# EduPlatform / Backend (Django)

To run the server follow these steps:
1. Clone the repository using `git clone`.
2. Install python 3.12 if you haven't already.
3. Install virtualenv using `pip install virtualenv`.
4. Create a local enviroment using `virtualenv "./.venvs"`
5. Enter the virtual enviroment using `.venvs/Scripts/activate`
6. Run `pip install -r requirements.txt`
7. Go to eduPlatform directory in your console
8. From the eduPlatform directory run `daphne eduPlatform.asgi:application` to start a development server.
   **Note**: *You must have daphne installed to run this, daphne itself should be included in the requirements, but make sure that it is installed correctly!*

To test the backend use
`python eduPlatform/manage.py test`