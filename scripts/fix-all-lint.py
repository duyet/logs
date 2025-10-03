#!/usr/bin/env python3
"""Fix all remaining linting issues"""
import re
from pathlib import Path

def remove_unused_imports(file_path):
    """Remove unused SuccessResponse, ErrorResponse, PingResponse imports"""
    content = file_path.read_text()

    # Pattern 1: Remove from type import with other types
    content = re.sub(
        r'import type \{ ([^}]+), (SuccessResponse|ErrorResponse|PingResponse)(, (SuccessResponse|ErrorResponse|PingResponse))*(, (SuccessResponse|ErrorResponse|PingResponse))* \}',
        r'import type { \1 }',
        content
    )

    # Pattern 2: Clean up double commas
    content = re.sub(r',\s*,', ',', content)

    # Pattern 3: Clean up trailing commas before }
    content = re.sub(r',\s*\}', ' }', content)

    file_path.write_text(content)
    return True

# Process all test files
test_files = [
    'test/e2e/endpoints.test.ts',
    'test/e2e/projects-api.test.ts',
    'test/e2e/analytics-api.test.ts',
    'test/unit/middleware/project-id.test.ts',
    'test/unit/middleware/logger.test.ts',
    'test/unit/adapters/base.test.ts',
    'test/unit/adapters/claude-code.test.ts',
    'test/unit/adapters/google-analytics.test.ts',
    'test/unit/services/analytics-query.test.ts',
    'test/unit/services/project.test.ts',
    'test/unit/services/analytics-engine.test.ts',
    'test/unit/utils/validation.test.ts',
]

for file_path_str in test_files:
    file_path = Path(file_path_str)
    if file_path.exists():
        remove_unused_imports(file_path)
        print(f"Fixed: {file_path}")

print("Done!")
