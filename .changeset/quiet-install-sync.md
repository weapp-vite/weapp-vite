---
'weapp-vite': patch
---

将工作区依赖声明同步从普通 `pnpm i` 中移出，避免安装后改写受 Git 跟踪的 manifest 和生成 catalog；新增 `pnpm deps:up` 作为显式升级入口，并提供 Git 索引锁诊断与安全清理命令。
