---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Windows 下 Vue `<style>` 请求带 `?query` 导致的路径读取错误，改用虚拟 ID 并在解析时还原真实路径。
