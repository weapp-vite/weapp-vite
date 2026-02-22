---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 运行时在 Node 环境加载时对 `import.meta.env.PLATFORM` 的直接读取问题：当 `import.meta.env` 不存在（如单元测试加载 `vite.config.ts`）时不再抛出异常，改为安全访问并继续走平台兜底逻辑，避免 `Cannot read properties of undefined (reading 'PLATFORM')` 导致构建/测试提前失败。
