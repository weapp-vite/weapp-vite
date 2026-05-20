---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 `weapp.wevu` 新增独立的 `minify` 开关，可按需控制 wevu 相关脚本输出是否压缩。默认保持当前可读输出行为，显式开启后仅影响 wevu 编译生成的脚本代码，不改变其他构建产物。
