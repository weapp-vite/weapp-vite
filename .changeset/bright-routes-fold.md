---
"wevu": patch
"@wevu/api": patch
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

移除会进入小程序运行时、编译输出和模板示例链路的 `Array.prototype.at()` 依赖，改用更基础的索引访问方式，避免低版本或受限小程序宿主缺少 `.at()` 时出现兼容性问题。
