"""Module for verifying Base64 encoded ICO data."""

import base64
import re
import sys
from pathlib import Path

EXPECTED_CLI_ARGS = 2  # Program name + JS file path
ICO_HEADER = b"\x00\x00\x01\x00"


def verify_base64_string(b64_str: str) -> None:
    """
    Verify a Base64 string.

    Args:
        b64_str: Base64 string to verify

    Raises:
        ValueError: If the string is not valid Base64 or contains disallowed characters

    """
    try:
        # Check for invalid characters
        if " " in b64_str:
            raise ValueError("Base64 string contains whitespace")
        if "\n" in b64_str:
            raise ValueError("Base64 string contains line breaks")

        # Try decoding
        try:
            base64.b64decode(b64_str)
        except Exception as e:
            raise ValueError("Invalid Base64 encoding") from e

        # Print verification results
        print("Base64 Verification:")
        print(f"Length: {len(b64_str)} characters")
        print("No whitespace: True")
        print("No line breaks: True")
        print("Valid Base64: True")

    except Exception as e:
        print(f"Error verifying Base64: {e}")
        sys.exit(1)


def verify_base64(js_file: str | Path) -> None:
    """
    Verify Base64 encoded ICO data in a JavaScript file.

    Args:
        js_file: Path to JavaScript file containing Base64 encoded ICO

    Prints:
        Base64 validation results

    """
    try:
        # Read the JavaScript file
        js = Path(js_file).read_text()

        # Extract Base64 string
        match = re.search('const FAVICON = [\'"](.+?)[\'"];', js)
        if not match:
            print("Error: No Base64 data found in JavaScript file")
            return

        b64_str = match.group(1)
        print(f"Base64 string length: {len(b64_str)} characters")
        print(f"First 32 chars: {b64_str[:32]}")
        print(f"Last 32 chars: {b64_str[-32:]}")

        verify_base64_string(b64_str)

        # Verify it's valid Base64
        try:
            ico_data = base64.b64decode(b64_str)
            print("\nBase64 decoding: Success")
            print(f"Decoded data size: {len(ico_data)} bytes")
        except Exception as e:
            print(f"\nBase64 decoding failed: {e}")
            return

        # Verify ICO header in decoded data
        if ico_data[:4] == ICO_HEADER:
            print("\nICO header verification: Success")
        else:
            print("\nICO header verification: Failed")
            print(f"Found header: {ico_data[:4].hex()}")

        # Verify UTF-8 encoding
        try:
            b64_str.encode("utf-8").decode("utf-8")
            print("\nUTF-8 encoding: Valid")
        except UnicodeError:
            print("\nUTF-8 encoding: Invalid")

    except Exception as e:
        print(f"Error during verification: {e}")


if __name__ == "__main__":
    if len(sys.argv) != EXPECTED_CLI_ARGS:
        print("Usage: python3 verify_base64.py <path_to_js_file>")
        sys.exit(1)
    verify_base64(sys.argv[1])
