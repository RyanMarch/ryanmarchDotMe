#!/bin/bash
# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "------------------------------------------------"
echo "🚀 RyanMarch.me Local Development Server"
echo "------------------------------------------------"
echo "This will start a local server for your site."
echo "Keep this window open while you work."
echo "Press Ctrl+C to stop the server."
echo "------------------------------------------------"

# Open the local site in the default browser
echo "Opening http://localhost:8000..."
open "http://localhost:8000"

# Start the Python server
python3 -m http.server 8000
