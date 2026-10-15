---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 按需加载 lib 声明编译器，减少普通构建提前初始化声明生成依赖的开销，并保留 lib 模式的依赖监听、错误传播和宿主产物生成顺序。
