---
'weapp-vite': patch
'create-weapp-vite': patch
---

补充 `autoRoutes` 对 `app.json`/`defineAppJson` 中分包信息的读取，并同步更新 typed declaration 输出位置、配置类型提示与相关测试用例，确保自动路由、类型生成与配置智能提示行为保持一致。
