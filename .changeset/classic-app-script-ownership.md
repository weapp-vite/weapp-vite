---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic 开发模式下仅修改页面样式也会重新写入 App 启动脚本、导致小程序意外重启的问题。App 脚本及其依赖统一由 bundler 构建，样式与配置更新不再使用编译器中间脚本覆盖已生成的入口。
