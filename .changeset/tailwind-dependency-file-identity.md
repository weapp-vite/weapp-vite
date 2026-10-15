---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Tailwind CSS 入口及配置依赖更新时，Windows 路径分隔符或目录别名导致编译缓存未失效、生成结果保留旧样式的问题。

将生成阶段发现的 Tailwind 配置和插件依赖同步到长期模块图，确保首次构建后新引入的模块修改也能触发 HMR 重建。
