---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): classic 回退仅为原生 CommonJS 入口添加旧会话缓存保护，保留 ESM 的顶层导入、导出及依赖加载语义，避免 ESM 项目在回退后生成无法解析的脚本。
