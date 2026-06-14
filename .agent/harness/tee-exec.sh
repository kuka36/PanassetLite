#!/usr/bin/env bash
# 运行命令并将 stdout+stderr 写入日志；保留被管道前命令的退出码。
# 用法：tee-exec.sh /path/to.log npm run lint
set -euo pipefail

log_file="${1:?log file path}"
shift

"$@" 2>&1 | tee "$log_file"
