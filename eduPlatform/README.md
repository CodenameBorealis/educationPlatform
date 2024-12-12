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

# For production deployment

To deploy the project for production first you need to make a file `.env.production` in the folder where `docker-compose.yml` is located.
The enviroment file is to be configured as described below:
```
IS_PRODUCTION=TRUE                     # Set the production to true
DJANGO_DB_NAME=db                      # The name of MySQL database
DJANGO_DB_USER=db-user                 # User for MySQL database
DJANGO_DB_PASSWORD=db-password         # User password for the database
DJANGO_DB_HOST=0.0.0.0                 # Database host
DJANGO_DB_PORT=3306                    # Database port
SECRET_KEY=django-security-key         # Django secret key
UPLOAD_PATH=/some/path/                # The path to uploads like profile pictures and etc.
CELERY_BROKER_URL=redis://redis:6379/0 # Broker for Celery (Redis in my case)
REDIS_URL=redis://redis:6379/0         # Database for web-conference caches (Redis)
```

**Warning:** For better compatability run the program as user named 'django', if you want to use a different name, make sure to change `docker-compose.yml` respectively.