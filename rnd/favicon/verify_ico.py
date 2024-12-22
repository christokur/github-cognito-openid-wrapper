"""Module for verifying ICO files and their Base64 representations."""

import base64
import re
import struct
import sys
from pathlib import Path
from typing import Optional

EXPECTED_CLI_ARGS = 2  # Program name + input file path
MIN_IMAGE_COUNT = 1  # Minimum number of images required in ICO
EXPECTED_COLOR_PLANES = 1  # Expected number of color planes for ICO


def verify_ico_bytes(ico_data: bytes) -> None:
    """
    Verify ICO format directly from bytes.

    Args:
        ico_data: Raw ICO file bytes

    Prints:
        ICO header information and directory entries

    """
    try:
        # Check ICO header
        header = struct.unpack("HHH", ico_data[:6])
        print("ICO Header:")
        print(f"Reserved: {header[0]:d} (should be 0)")
        print(f"Type: {header[1]:d} (should be 1 for ICO)")
        print(f"Image count: {header[2]:d}")

        # Check each directory entry
        offset = 6
        for i in range(header[2]):
            entry = struct.unpack("BBBBHHII", ico_data[offset:offset+16])
            print(f"\nICO Directory Entry {i+1:d}:")
            print(f"Width: {entry[0] or 256:d}")
            print(f"Height: {entry[1] or 256:d}")
            print(f"Color palette: {entry[2]:d}")
            print(f"Reserved: {entry[3]:d} (should be 0)")
            print(f"Color planes: {entry[4]:d} (should be 1 for ICO)")
            print(f"Bits per pixel: {entry[5]:d}")
            print(f"Data size: {entry[6]:d} bytes")
            print(f"Data offset: {entry[7]:d} bytes")
            offset += 16

        # Verify ICO format requirements
        if header[0] != 0:
            raise ValueError("Invalid ICO: Reserved field should be 0")
        if header[1] != 1:
            raise ValueError("Invalid ICO: Type field should be 1")
        if header[2] < MIN_IMAGE_COUNT:
            raise ValueError("Invalid ICO: Must contain at least one image")

    except struct.error as err:
        raise ValueError(f"Invalid ICO format: {str(err)}") from err


def extract_base64_from_js(js_file: str | Path) -> str:
    """
    Extract Base64 data from JavaScript file.

    Args:
        js_file: Path to JavaScript file containing Base64 encoded ICO

    Returns:
        Base64 encoded string

    Raises:
        ValueError: If Base64 data not found in file

    """
    js_content = Path(js_file).read_text()
    base64_match = re.search(r"\"([A-Za-z0-9+/=]+)\"", js_content)
    if not base64_match:
        raise ValueError("No Base64 data found in JavaScript file")
    return base64_match.group(1)


def verify_ico(js_file: str | Path) -> None:
    """
    Verify the ICO format from a Base64 string in a JavaScript file.

    Args:
        js_file: Path to JavaScript file containing Base64 encoded ICO

    Raises:
        ValueError: If ICO format is invalid

    """
    try:
        base64_data = extract_base64_from_js(js_file)
        ico_data = base64.b64decode(base64_data)
        verify_ico_bytes(ico_data)
    except Exception as err:
        raise ValueError(f"Error verifying ICO format: {str(err)}") from err


def process_input_file(input_file: str | Path, output_file: Optional[str | Path] = None) -> None:
    """
    Process input file (either .js or .ico) and verify/output ICO data.

    Args:
        input_file: Path to input file (.js or .ico)
        output_file: Optional path for output .ico file

    Raises:
        ValueError: If input file format is invalid

    """
    input_path = Path(input_file)

    if input_path.suffix.lower() == ".ico":
        # Direct ICO file input
        ico_data = input_path.read_bytes()
    else:
        # JavaScript file input
        base64_data = extract_base64_from_js(input_path)
        ico_data = base64.b64decode(base64_data)

    # Verify the ICO format
    verify_ico_bytes(ico_data)

    # If output path is specified and ends with .ico, write the ICO file
    if output_file:
        output_path = Path(output_file)
        if output_path.suffix.lower() == ".ico":
            output_path.write_bytes(ico_data)
            print(f"\nICO file written to: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != EXPECTED_CLI_ARGS:
        print("Usage: python3 verify_ico.py <path_to_input_file> [output_ico_file]")
        sys.exit(1)

    try:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        process_input_file(input_file, output_file)
    except Exception as err:
        print(f"Error: {str(err)}")
        sys.exit(1)
