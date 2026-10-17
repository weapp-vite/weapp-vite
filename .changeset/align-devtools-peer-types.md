---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 对齐 @vitejs/devtools-kit 的可选 peer 依赖范围与当前构建链版本，避免安装 0.8.x 时出现错误的类型契约校验，并同步 create-weapp-vite 模板依赖契约。
