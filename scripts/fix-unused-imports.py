#!/usr/bin/env python3
import re
from pathlib import Path

files_to_fix = [
    'test/unit/middleware/logger.test.ts',
    'test/unit/adapters/base.test.ts',
    'test/unit/adapters/google-analytics.test.ts',
    'test/unit/services/analytics-query.test.ts',
    'test/unit/services/project.test.ts',
    'test/unit/utils/validation.test.ts',
]

for file_path in files_to_fix:
    path = Path(file_path)
    if not path.exists():
        print(f"Skipping {file_path} (not found)")
        continue

    content = path.read_text()

    # Remove unused imports
    content = re.sub(r', SuccessResponse, ErrorResponse, PingResponse', '', content)

    path.write_text(content)
    print(f"Fixed: {file_path}")

print("Done!")
