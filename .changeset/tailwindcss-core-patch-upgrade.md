---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-core/init": patch
---

升级 weapp-tailwindcss 至 5.5.2，同步默认依赖与固定版本回归环境，纳入 CSS 导入解析、跨平台扫描路径及删除文件候选失效修复。保留现有 Core 编译器集成和单一 Tailwind CSS 生成入口。

同步脚手架模板 catalog 与初始化依赖解析的离线回退版本；注册表不可用时继续保留已有项目声明的版本。
