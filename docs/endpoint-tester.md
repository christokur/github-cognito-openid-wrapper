# OIDC Endpoint Tester

This document describes the use cases for the OIDC endpoint testing tool.

## Use Cases

### UC1: Default Test Suite

```bash
node scripts/test-endpoints.js [--log-level <level>]
```

- Tests all OIDC endpoints (authorization, token, userinfo)
- Tests favicon.ico with detailed analysis
- Shows summary of pass/fail results
- Validates HTTP methods per endpoint
- Discovers endpoints via .well-known/openid-configuration

### UC2: Remote Server Testing

```bash
node scripts/test-endpoints.js --url <url> [--log-level <level>]
```

- Same as UC1 but against a remote server
- No local server startup needed
- Useful for testing deployed instances

### UC3: Favicon-Only Testing

```bash
node scripts/test-endpoints.js --favicon [--log-level <level>]
```

- Only tests the favicon.ico endpoint
- Shows detailed favicon analysis:
  - Content type validation
  - Size information
  - Base64 payload
  - File location
  - ICO format validation
  - Cache control headers

### UC4: Help Mode

```bash
node scripts/test-endpoints.js --help
```

- Displays usage instructions
- Shows available options
- Provides example commands

## Common Options

### Log Level

The `--log-level` option can be used with UC1-UC3 to control output verbosity:

```bash
--log-level error   # Only show errors
--log-level warn    # Show warnings and errors
--log-level info    # Show normal information (default)
--log-level debug   # Show detailed debugging information
```

## Example Output

### Favicon Analysis

When testing the favicon (in UC1-UC3), you'll see output like:

```
=== Favicon Report ===
Content Type: image/x-icon
Size: 1234 bytes
Base64 Payload: (base64 string)
Saved to: /tmp/favicon.ico
Valid ICO Format: ✓ Yes
Cache Control: public, max-age=3600
===================
```
