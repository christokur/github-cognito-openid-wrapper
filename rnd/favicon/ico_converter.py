"""Module for converting images to ICO format."""

import io
import sys
from pathlib import Path

from PIL import Image

from .verify_ico import verify_ico_bytes


def convert_to_ico(image_path: str | Path, output_path: str | Path = None) -> bytes:
    """
    Convert an image to ICO format and optionally save it to a file.

    Args:
        image_path: Path to the input image file
        output_path: Optional path to save the ICO file

    Returns:
        bytes: The ICO image as bytes

    Raises:
        FileNotFoundError: If the image file doesn't exist
        IOError: If the image file can't be read
        ValueError: If the file is not a valid image format
    """
    try:
        # Convert to Path objects
        input_path = Path(image_path)
        output_path = Path(output_path) if output_path else None

        # Verify input file exists
        if not input_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        # Open and verify the image
        try:
            img = Image.open(input_path)
            img.verify()  # Verify it's a valid image
            img = Image.open(input_path)  # Reopen after verify
        except Exception as e:
            raise ValueError("Invalid image format") from e

        print(f"Successfully loaded image: format={img.format}, mode={img.mode}, size={img.size}")

        # Convert to RGBA if needed
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # Resize to 32x32 (standard favicon size)
        img = img.resize((32, 32), Image.Resampling.LANCZOS)

        # Save to bytes
        ico_buffer = io.BytesIO()
        img.save(ico_buffer, format='ICO')
        ico_bytes = ico_buffer.getvalue()

        # Verify the ICO format
        verify_ico_bytes(ico_bytes)

        # Save to file if output path is provided
        if output_path:
            output_path.write_bytes(ico_bytes)
            print(f"ICO file saved to: {output_path}")

        return ico_bytes

    except Exception as e:
        print(f"Error converting image to ICO: {str(e)}", file=sys.stderr)
        raise
