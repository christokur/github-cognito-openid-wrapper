#!/bin/bash

# Get all arguments after the test name
node scripts/test-endpoints.js --log-level debug --test "Token POST with valid form params"
