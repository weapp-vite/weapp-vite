---
'@mpcore/simulator': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 headless simulator 对入口页、ESM/CJS 模块、测试桥接事件与运行时状态的处理，并修复支付宝 SJS 顶层 CommonJS 导出转换，补充对应回归测试。
