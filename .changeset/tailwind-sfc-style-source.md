---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 外部样式使用内置 Tailwind CSS 时因样式编译改变空白而丢失入口归属的问题。根据 `style src` 解析实际文件，确保预检样式和工具类统一由 Tailwind 生成器处理，避免原始编译期样式混入小程序产物，并保留别名解析与热更新依赖。
