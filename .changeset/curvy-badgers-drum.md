---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `injectRequestGlobals` 场景下 `axios` fetch adapter 的运行时注入，构建产物会自动为 axios chunk 补齐 `Request`、`Response`、`fetch` 所需环境，不再需要业务代码手动修改 `axios.defaults.adapter` 或 `axios.defaults.env`。
