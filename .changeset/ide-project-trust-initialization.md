---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复首次打开微信开发者工具项目前预建不完整信任记录的问题。仅更新 IDE 已完成导入的项目缓存，保留项目能力配置，避免缺失 `attr.setting` 导致编译失败和自动化连接超时。
