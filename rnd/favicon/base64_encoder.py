"""Module for encoding ICO images to Base64 format."""

import base64
import sys
from pathlib import Path

from .ico_converter import convert_to_ico
from .verify_base64 import verify_base64_string


def encode_image_to_base64(image_path: str | Path) -> str:
    """
    Convert an image to ICO and encode it to a Base64 string.

    Args:
        image_path: Path to the image file

    Returns:
        str: Base64-encoded string of the ICO image

    """
    try:
        # Convert to ICO first
        ico_bytes = convert_to_ico(image_path)

        # Encode to base64 and strip newlines
        b64_str = base64.b64encode(ico_bytes).decode("utf-8")
        b64_str = b64_str.replace("\n", "")

        # Verify Base64 encoding
        verify_base64_string(b64_str)

        return b64_str

    except Exception as e:
        print(f"Error encoding image: {e}")
        sys.exit(1)
