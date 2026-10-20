---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Vue SFC 最终 JSON 合成时重新加入 PascalCase 组件注册的问题，保持编译器生成的标签名称和配置合并策略生效。
