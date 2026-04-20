---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复了绝对 `node_modules` alias 导入在 pnpm hoist 安装场景下的 npm 包根解析问题。现在即使导入路径指向包内不存在的局部 `node_modules` 位置，`weapp-vite` 也会按 Node 解析规则回退到真实安装位置读取包的 `miniprogram` 配置，从而正确去掉 `tdesign-miniprogram/miniprogram_dist` 这类小程序入口前缀，恢复子包 `miniprogram_npm` 本地化与相关发布测试流程。
