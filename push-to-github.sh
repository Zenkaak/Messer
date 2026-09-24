#!/bin/bash
# Run this script from the workspace root to push the project to GitHub.
# Requires GITHUB_PERSONAL_ACCESS_TOKEN to be set as a Replit secret.

set -e

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set."
  exit 1
fi

GITHUB_USER="Zenkaak"
GITHUB_REPO="Messer"

echo "Setting remote with PAT..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

echo "Pushing to GitHub..."
git push origin main

echo "Done! Project pushed to https://github.com/${GITHUB_USER}/${GITHUB_REPO}"
