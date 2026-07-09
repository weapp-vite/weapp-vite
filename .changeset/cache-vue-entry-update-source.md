---
"weapp-vite": patch
"create-weapp-vite": patch
---

复用 Vue 文件 HMR 更新判定中的源码读取结果，避免同一次变更为了判断 json-only、local-asset-only、style-only 和 app shell topology 重复读取与扫描同一个 SFC。
