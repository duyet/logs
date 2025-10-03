#!/bin/bash

# Fix unnecessary type assertions
find test/ -name "*.test.ts" -type f -exec sed -i '' 's/) as SuccessResponse | ErrorResponse;/);/g' {} \;

# Add no-unnecessary-type-assertion disable for tests that need it
for file in test/e2e/analytics-api.test.ts test/e2e/projects-api.test.ts test/unit/middleware/project-id.test.ts; do
  if [ -f "$file" ]; then
    # Add disable comment if not present
    if ! grep -q "@typescript-eslint/no-unnecessary-type-assertion" "$file"; then
      sed -i '' '1i\
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
' "$file"
    fi
  fi
done

# Remove unused PingResponse import from analytics-api.test.ts
sed -i '' 's/, PingResponse//g' test/e2e/analytics-api.test.ts

echo "Lint fixes applied!"
