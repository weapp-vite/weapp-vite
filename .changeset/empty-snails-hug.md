---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复程序化调用 `createCompilerContext` 时在干净工作区中加载 `vite.config.ts` 可能因为缺少 `.weapp-vite/tsconfig.*.json` 而失败的问题。现在在传入 `cwd` 创建编译上下文前会先补齐托管 tsconfig 引导文件，并补充 Web 配置加载的回归测试，避免 CI 或新检出环境下出现 `Tsconfig not found`。
