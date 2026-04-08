---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复开发态 watch 在编辑器 rename-save/原子保存场景下把短暂的 `delete` 事件当成真实删除处理的问题。现在同路径文件在短时间内重新出现时会按 `update` 归一化处理，避免热更新基于暂时缺失或半写入的源码生成不完整的页面 chunk / `common.js`，从而减少原生小程序保存后偶发丢代码与共享导出错位。
