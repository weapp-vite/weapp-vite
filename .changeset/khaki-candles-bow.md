---
"weapp-vite": patch
"create-weapp-vite": patch
---

收紧原生 WXML 中 `import.meta` 的替换边界：仅保留 `import.meta.env.xxx`、`import.meta.url` 与 `import.meta.dirname` 这类标量值替换，不再支持 `import.meta.env` 或裸 `import.meta` 的对象级替换，避免为低收益场景引入额外注入链路与不稳定产物。
