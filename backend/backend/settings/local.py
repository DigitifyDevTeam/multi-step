"""
Local/dev settings.
"""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path


# Django 4.2 template/admin rendering can crash on Python 3.14.
try:
    from ..django_compat import patch_django_template_context_copy

    patch_django_template_context_copy()
except Exception:
    # Best-effort patch; if anything goes wrong, don't block startup.
    pass


BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv_if_present() -> None:
    """
    Minimal .env loader (no external dependency).
    Loads `backend/.env` into process env if present.
    """
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        # Never block startup if dotenv parsing fails.
        pass


_load_dotenv_if_present()


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev")
DEBUG = True
ALLOWED_HOSTS = ["*"]


ADMIN_RESERVATION_EMAIL = os.environ.get(
    "ADMIN_RESERVATION_EMAIL", "contact@deepcleaning.fr"
)

GMAIL_SENDER_EMAIL = os.environ.get("GMAIL_SENDER_EMAIL")
GMAIL_OAUTH_ACCESS_TOKEN = os.environ.get("GMAIL_OAUTH_ACCESS_TOKEN")
GMAIL_OAUTH_REFRESH_TOKEN = os.environ.get("GMAIL_OAUTH_REFRESH_TOKEN")
GMAIL_OAUTH_CLIENT_ID = os.environ.get("GMAIL_OAUTH_CLIENT_ID")
GMAIL_OAUTH_CLIENT_SECRET = os.environ.get("GMAIL_OAUTH_CLIENT_SECRET")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "import_export",
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "backend.wsgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("DB_NAME", "deepclean"),
        "USER": os.environ.get("DB_USER", "root"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "root"),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "3306"),
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


CORS_ALLOW_ALL_ORIGINS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://172.16.216.125",
    "http://172.16.216.125:5173",
]


STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")

GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY")


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_MINUTES", "60"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7"))),
}

