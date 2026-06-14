#!/usr/bin/env bash
# 运行 lint + build，输出写入 /tmp/lint.log、/tmp/build.log；失败时返回非 0。
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set +e
bash "$HARNESS_DIR/tee-exec.sh" /tmp/lint.log npm run lint
lint_ec=$?
build_ec=0
if [ "$lint_ec" -eq 0 ]; then
  bash "$HARNESS_DIR/tee-exec.sh" /tmp/build.log npm run build
  build_ec=$?
else
  printf '%s\n' '(skipped — lint failed)' > /tmp/build.log
  build_ec=1
fi
set -e

if [ "$lint_ec" -ne 0 ] || [ "$build_ec" -ne 0 ]; then
  exit 1
fi
