#!/usr/bin/env bash
# Builds the public website as static files in ./out (used by the GitHub Pages workflow).
# Run only in a disposable checkout: it deletes the server-only parts of src/app.
set -euo pipefail
rm -rf src/app/management src/app/portal src/app/api src/middleware.ts tests vitest.config.ts \
  src/components/erp src/components/portal src/lib/erp src/lib/portal src/lib/server src/lib/auth src/lib/intake
mkdir -p src/app/portal/login src/app/management/login
cp preview/app/PreviewNotice.tsx src/app/PreviewNotice.tsx
cp preview/app/portal/login/page.tsx src/app/portal/login/page.tsx
cp preview/app/management/login/page.tsx src/app/management/login/page.tsx
rm -rf preview
STATIC_PREVIEW=1 NEXT_PUBLIC_STATIC_PREVIEW=1 npx next build
touch out/.nojekyll
