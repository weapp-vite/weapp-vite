---
'weapp-vite': patch
---

为自动导入新增 WeUI 解析器，默认生成 `mp-` 前缀映射（如 `mp-form` -> `weui-miniprogram/form/form`），并在生成脚本中忽略非组件目录。 
