---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复配置加载与仓库构建稳定性问题。`weapp-vite` 现在默认使用原生 ESM 方式加载 `vite.config.ts` / `weapp-vite.config.ts`，避免在配置阶段错误走到 `require` 链路；同时仓库内示例、模板与测试夹具统一改为从 `weapp-vite` 根入口导入 `defineConfig` 等导出。另一个修复是为测试夹具补齐唯一的 workspace 名称，避免 `turbo` 在 monorepo 构建时因重复包名直接中断。
