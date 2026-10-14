---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 将页面本地组件发现改为每批最多 8 页的独立解析与读取，减少多页面冷启动的串行文件等待。按原页面和 import 声明顺序归并结果，批次全部任务终结后再传播首错；保留入口选择、缺失和读取失败语义，每次构建重新读取源码，不跨 context 或构建缓存结果。
