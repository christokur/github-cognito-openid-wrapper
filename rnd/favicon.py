"""Command-line interface for favicon generation and embedding."""

import argparse
import sys
from pathlib import Path

from favicon import (
    convert_to_ico,
    encode_image_to_base64,
    generate_html_file,
    update_js_file,
)


def main() -> None:
    """Process an image file and generate favicon-related output files."""
    parser = argparse.ArgumentParser(description="Embed a Base64-encoded favicon into an HTML, .js, or .ico file.")
    parser.add_argument("image", help="Path to the source image file (PNG, ICO, JPG, GIF, etc.).")
    parser.add_argument("output", help="Path to the output file (.html, .js, or .ico).")

    args = parser.parse_args()

    # Validate the image file
    image_path = Path(args.image)
    if not image_path.is_file():
        print(f"Error: Image file '{args.image}' not found.")
        sys.exit(1)

    # Validate the output file type
    if not args.output.endswith((".html", ".js", ".ico")):
        print("Error: Output file must be .html, .js, or .ico.")
        sys.exit(1)

    # Process based on the output file type
    if args.output.endswith(".ico"):
        # Direct ICO conversion and save
        convert_to_ico(args.image, args.output)
        print(f"ICO file generated: {args.output}")
    else:
        # Encode the image to Base64 for HTML/JS output
        base64_string = encode_image_to_base64(args.image)
        
        if args.output.endswith(".html"):
            generate_html_file(args.output, base64_string)
        elif args.output.endswith(".js"):
            update_js_file(args.output, base64_string)


if __name__ == "__main__":
    main()
