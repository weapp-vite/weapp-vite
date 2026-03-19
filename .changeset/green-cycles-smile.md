---
'weapp-vite': patch
---

修复安装链路中的稳定性问题：当前仓库在无交互环境下执行 `pnpm install` 可能因 `node_modules` 清理确认而直接中断，同时 `weapp-vite prepare` 在 `postinstall` 场景下遇到异常时不应打断用户的安装命令。现在仓库自身通过 `confirm-modules-purge=false` 规避无 TTY 中断，且 `prepare` 在 bin/CLI 两层都会降级为 warning 或强制保持成功退出，不再让 `pnpm i` 因该命令失败。
