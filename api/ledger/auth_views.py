import time
from typing import Any

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from .errors import ApiError
from .flags import all_flags
from .members import display_name
from .permissions import csrf_check
from .serializers import (
    EmptySerializer,
    ErrorSerializer,
    FlagsSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    MeSerializer,
)
from .throttles import LoginIPThrottle, LoginUserThrottle
from .views import LedgerView


def user_payload(user: Any) -> dict[str, str]:
    return {"email": str(user.email or user.username), "name": display_name(user)}


class FlagsView(LedgerView):
    """Flags evaluated server-side. The UI mirrors them; the server enforces them (trap 25)."""

    permission_classes = [AllowAny]

    @extend_schema(operation_id="getFlags", responses={200: FlagsSerializer})
    def get(self, request: Request) -> Response:
        return Response(all_flags())


class CsrfView(LedgerView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id="getCsrf", responses={200: EmptySerializer})
    def get(self, request: Request) -> Response:
        get_token(request._request)  # sets the csrftoken cookie
        return Response({})


class LoginView(LedgerView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginIPThrottle, LoginUserThrottle]
    auto_scope = False

    @extend_schema(
        operation_id="login",
        request=LoginRequestSerializer,
        responses={200: LoginResponseSerializer, 400: ErrorSerializer, 429: ErrorSerializer},
    )
    def post(self, request: Request) -> Response:
        csrf_check(request)
        ser = LoginRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = authenticate(
            request._request,
            username=ser.validated_data["email"].strip().lower(),
            password=ser.validated_data["password"],
        )
        if user is None:
            raise ApiError(400, "invalid_credentials", "That email and password don't match.")
        login(request._request, user)  # rotates the session key
        request._request.session["last_activity"] = int(time.time())
        return Response(
            {"user": user_payload(user), "idle_timeout_seconds": settings.IDLE_TIMEOUT_SECONDS}
        )


class LogoutView(LedgerView):
    permission_classes = [AllowAny]  # idempotent: logging out when already out is fine

    @extend_schema(operation_id="logout", request=None, responses={200: EmptySerializer})
    def post(self, request: Request) -> Response:
        logout(request._request)
        return Response({})


class MeView(LedgerView):
    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="getMe", responses={200: MeSerializer, 401: ErrorSerializer})
    def get(self, request: Request) -> Response:
        # Read-only on purpose: asking how long is left must not extend the session (trap 18).
        last = int(request._request.session.get("last_activity") or 0)
        left = max(0, settings.IDLE_TIMEOUT_SECONDS - (int(time.time()) - last))
        return Response(
            {
                "user": user_payload(request.user),
                "idle_timeout_seconds": settings.IDLE_TIMEOUT_SECONDS,
                "expires_in_seconds": left,
            }
        )
