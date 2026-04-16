---
'weapp-vite': patch
'create-weapp-vite': patch
---

将 `weapp-vite` 内部散落的默认平台回退收敛到统一 helper，避免 `supportFiles`、Vue transform、WXML 事件解析、npm dist 等链路继续各自写死 `weapp`。
