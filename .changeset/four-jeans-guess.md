---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生 layout 目录下 `index.ts` 脚本不会被发射为输出 `js` 资源的问题。现在原生 layout 脚本支持以 TypeScript 编写，构建时会自动去除类型并生成对应的 `.js` 文件，避免出现跳过脚本发射的告警。
