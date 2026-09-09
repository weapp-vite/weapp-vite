---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复内置 Tailwind CSS 在样式合并或重新发射后重复生成工具类的问题，确保最终样式只生成一次，并保留微信 WXSS 兼容处理和热更新后的最新样式。
