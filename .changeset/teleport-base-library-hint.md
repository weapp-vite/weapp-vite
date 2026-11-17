---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: Teleport 基础库版本提示改为按项目配置判断并只提示一次。

编译器现在读取 `project.config.json` / `project.private.config.json` 的 `libVersion`（私有配置优先）：满足 `>= 2.26.1` 时不再输出 `WV1010`；低于门槛或 `latest` / `trial` 等无法静态判断的别名，同一次构建只提示一次。
