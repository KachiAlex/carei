#!/bin/bash
# Patch server.js to add new routes

SERVER_JS="/var/www/carei/server/server.js"

# Add new top-level routes
sed -i "s/'visit-start', 'visits', 'voice-memos',/'visit-start', 'visits', 'voice-memos', 'compliance-dashboard', 'risk-alerts', 'staff-matching', 'outcome-indicators',/" "$SERVER_JS"

# Add new anthropic routes
sed -i "s/const anthropicRoutes = \['chat', 'summary'\]/const anthropicRoutes = ['chat', 'summary', 'care-plan', 'report', 'family-update', 'structure-notes']/" "$SERVER_JS"

echo "=== Patched server.js ==="
grep -n "compliance\|risk-alerts\|staff-matching\|outcome-indicators\|care-plan\|family-update\|structure-notes" "$SERVER_JS"
