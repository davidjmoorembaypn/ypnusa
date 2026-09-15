#!/bin/bash
find . -name "index.html" ! -path "*/wp-*" ! -path "*/_archive*" | while read FILE; do
  if grep -q 'class="header-nav"' "$FILE" 2>/dev/null; then
    sed -i 's|<nav class="header-nav"[^>]*>.*</nav>|<nav class="header-nav" aria-label="Main navigation"><a href="https://ypnus.com" class="nav-link">Home<\/a><a href="https://ypnus.com/features/" class="nav-link">Features<\/a><a href="https://ypnus.com/platform/" class="nav-link">Platform<\/a><a href="https://ypnus.com/pricing/" class="nav-link">Pricing<\/a><a href="https://ypnus.com/blog/" class="nav-link">Blog<\/a><a href="https://ypnus.com/about/" class="nav-link">About<\/a><a href="https://ypnus.com/contact/" class="nav-link">Contact<\/a><a href="https://ypnus.com\/free-trial\/" class="nav-link nav-cta">Get Started Free<\/a><\/nav>|g' "$FILE"
    echo "Fixed nav: $FILE"
  fi
done
echo "DONE — all navs updated"
