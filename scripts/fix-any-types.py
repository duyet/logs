#!/usr/bin/env python3
import re
import sys
from pathlib import Path

def fix_any_types(file_path):
    """Replace 'as any' with proper response types in test files"""
    with open(file_path, 'r') as f:
        content = f.read()

    # Add import if not present
    if 'SuccessResponse' not in content and 'ErrorResponse' not in content:
        # Find the import block and add our types
        import_pattern = r'(import type \{[^}]+\} from [\'"]\.\.\/\.\.\/src\/types\/index\.js[\'"];)'
        if re.search(import_pattern, content):
            content = re.sub(
                import_pattern,
                lambda m: m.group(1).replace('} from', ', SuccessResponse, ErrorResponse, PingResponse } from'),
                content
            )
        else:
            # Add new import after other imports
            content = re.sub(
                r"(import .+ from ['\"].+['\"];)\n",
                r"\1\nimport type { SuccessResponse, ErrorResponse, PingResponse } from '../../src/types/index.js';\n",
                content,
                count=1
            )

    # Replace 'as any' with appropriate types based on context
    # For error responses (status 400, 404, 500)
    content = re.sub(
        r'(\(await res\.json\(\)\)) as any;(\s+expect\(res\.status\)\.toBe\((400|404|500)\))',
        r'\1 as ErrorResponse;\2',
        content
    )

    # For success responses (status 200, 201)
    content = re.sub(
        r'(\(await res\.json\(\)\)) as any;(\s+expect\(res\.status\)\.toBe\((200|201)\))',
        r'\1 as SuccessResponse;\2',
        content
    )

    # For /ping responses
    content = re.sub(
        r"(\(await res\.json\(\)\)) as any;(\s+expect\(res\.status\)\.toBe\(200\);[\s\S]{0,50}status: 'ok')",
        r'\1 as PingResponse;\2',
        content
    )

    # Remaining 'as any' -> generic response type
    content = re.sub(
        r'\) as any;',
        r') as SuccessResponse | ErrorResponse;',
        content
    )

    with open(file_path, 'w') as f:
        f.write(content)

    print(f"Fixed: {file_path}")

# Process all test files
test_dir = Path('test')
for test_file in test_dir.rglob('*.test.ts'):
    fix_any_types(test_file)

print("Done!")
