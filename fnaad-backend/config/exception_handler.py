"""Custom DRF exception handler that catches Django's RequestDataTooBig
and returns a friendly 413 instead of letting it bubble up as a 500."""

from django.core.exceptions import RequestDataTooBig
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import exception_handler as drf_exception_handler


def custom_exception_handler(exc, context):
    # Django raises RequestDataTooBig when DATA_UPLOAD_MAX_MEMORY_SIZE is
    # exceeded. DRF doesn't handle it by default, so it surfaces as a 500.
    if isinstance(exc, RequestDataTooBig):
        return Response(
            {"detail": "The file is too large for the server to accept. Choose a smaller file."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    return drf_exception_handler(exc, context)
