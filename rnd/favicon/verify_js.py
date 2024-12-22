"""Module for verifying JavaScript file generation."""

import re
import sys
from pathlib import Path

EXPECTED_CLI_ARGS = 2  # Program name + JS file path
EXPECTED_QUOTE_COUNT = 2  # Opening and closing quotes
FAVICON_VAR_NAME = "FAVICON"
FAVICON_PREFIX = f"const {FAVICON_VAR_NAME} = "


def verify_js(js_file: str | Path) -> None:
    """
    Verify the JavaScript file format and content.

    Args:
        js_file: Path to JavaScript file to verify

    Prints:
        JavaScript validation results

    """
    try:
        # Read the JavaScript file
        content = Path(js_file).read_text()

        print("JavaScript File Analysis:")
        print(f"File size: {len(content)} bytes")

        # Extract and analyze Base64 content
        match = re.search(f'{FAVICON_PREFIX}[\'"](.+?)[\'"];', content)
        if not match:
            print("\nContent check: Failed")
            print("Error: Could not find FAVICON constant")
            return

        b64_str = match.group(1)
        print("\nContent check: Success")
        print(f"Base64 string length: {len(b64_str)} characters")

        # Check for common issues
        print("\nValidation checks:")
        print(f"- No whitespace in Base64: {' ' not in b64_str}")
        print("- No line breaks in Base64:", "\n" not in b64_str)
        print(f"- Valid variable name: {FAVICON_VAR_NAME in content}")
        quote_count = sum(1 for c in b64_str if c in "'\"")
        print(f"- Proper quotes: {quote_count == 0}")

    except Exception as e:
        print(f"Error during verification: {e}")


if __name__ == "__main__":
    if len(sys.argv) != EXPECTED_CLI_ARGS:
        print("Usage: python3 verify_js.py <path_to_js_file>")
        sys.exit(1)
    verify_js(sys.argv[1])
