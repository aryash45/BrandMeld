"""
conftest.py — pytest configuration for BrandMeld backend tests.
"""
import sys
import os

# Ensure the backend/app package is importable when running pytest from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
