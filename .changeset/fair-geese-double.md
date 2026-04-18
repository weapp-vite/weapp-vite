"@weapp-core/init": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp-vite` 发布链路中对 `@weapp-core/init` 的旧产物依赖，避免 `pnpm dev:open` 等命令在安装最新依赖后因 `@weapp-core/shared` 根入口不再导出 `fs` 而直接崩溃。同时为 `@weapp-core/*` 增加 changeset 守卫，并为 `@weapp-core/init` 增加打包产物回归测试，防止类似的内部依赖版本漂移再次进入发布结果。
