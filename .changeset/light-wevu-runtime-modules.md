---
"@weapp-core/shared": minor
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

降低 wevu 在正常 tree-shaking 下的小程序与 Web 运行时体积，并让微信开发者工具 HMR 稳定识别新版 preserve-modules 产物，避免局部更新后出现运行时 vendor 模块缺失。
