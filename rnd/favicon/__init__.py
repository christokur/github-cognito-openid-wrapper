"""Package for favicon generation and related utilities."""

from .base64_encoder import encode_image_to_base64
from .file_generator import generate_html_file, update_js_file
from .ico_converter import convert_to_ico
from .verify_base64 import verify_base64
from .verify_ico import verify_ico
from .verify_js import verify_js

__all__ = [
    "convert_to_ico",
    "encode_image_to_base64",
    "generate_html_file",
    "update_js_file",
    "verify_base64",
    "verify_ico",
    "verify_js",
]
