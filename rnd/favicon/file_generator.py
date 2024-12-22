"""Module for generating HTML and JavaScript files with embedded favicons."""

import re
import sys
from pathlib import Path

from .verify_js import verify_js

FAVICON_TEMPLATE = """const FAVICON = "";"""


def update_js_file(js_file_path: str | Path, base64_string: str) -> None:
    """
    Update the given .js file by replacing the Base64 string in the specified section.

    Args:
        js_file_path: Path to the .js file
        base64_string: New Base64-encoded string to embed

    """
    try:
        path = Path(js_file_path)
        content = FAVICON_TEMPLATE if not path.exists() else path.read_text()

        # Replace the existing Base64 string in the JS section
        updated_content = re.sub(
            r"(const FAVICON = ').*?(')",
            rf"\1{base64_string}\2",
            content,
            flags=re.DOTALL,
        )

        # Write with Unix line endings
        path.write_text(updated_content, newline="\n")

        # Verify JavaScript format
        verify_js(path)

        print(f"Updated JavaScript file: {js_file_path}")

    except Exception as e:
        print(f"Error updating JavaScript file: {e}")
        sys.exit(1)


def generate_html_file(html_file_path: str | Path, base64_string: str) -> None:
    """
    Generate an HTML file with the embedded Base64 favicon.

    Args:
        html_file_path: Path to the output HTML file
        base64_string: Base64-encoded string of the image

    """
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Favicon Preview</title>
    <style>
        body {{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell,
                "Open Sans", "Helvetica Neue", sans-serif;
        }}
        .preview {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 300px;
        }}
        .favicon-container {{
            margin: 20px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #333;
        }}
        .favicon-container img {{
            background: white;
            padding: 5px;
            border-radius: 4px;
        }}
        .size-label {{
            color: #fff;
            margin-top: 10px;
            font-size: 14px;
        }}
        h2 {{
            margin-bottom: 20px;
        }}
    </style>
</head>
<body>
    <div class="preview">
        <h2>Favicon Preview</h2>

        <div class="favicon-container">
            <img class="favicon" width="16" height="16" src="data:image/x-icon;base64,{base64_string}">
            <div class="size-label">16x16 (Actual Size)</div>
        </div>

        <div class="favicon-container">
            <img class="favicon" width="32" height="32" src="data:image/x-icon;base64,{base64_string}">
            <div class="size-label">32x32 (2x)</div>
        </div>

        <div class="favicon-container">
            <img class="favicon" width="64" height="64" src="data:image/x-icon;base64,{base64_string}">
            <div class="size-label">64x64 (4x)</div>
        </div>
    </div>
</body>
</html>"""
    try:
        path = Path(html_file_path)
        path.write_text(html_content, newline="\n")
        print(f"Generated HTML file: {html_file_path}")

    except Exception as e:
        print(f"Error writing HTML file: {e}")
        sys.exit(1)
