---
"weapp-vite": major
---

feat!: 全量切换到 rolldown-vite

# weapp-vite 切换到 rolldown-vite

迁移过程非常平滑，只改了部分 watcher 相关的使用代码的实现 (因为 rolldown watcher 没有 onCurrentRun 方法了) 

然后我以我一个复杂的测试案例进行性能测试，主包有 726 个模块，独立分包有 643 个模块，测试结果如下：
 
整体平均构建时间提升：约 1.86 倍

热更新平均构建时间提升：约 2.50 倍

vite 的整体平均构建时间为 4302.26 ms, 构建热更新平均构建时间为 2216.58 ms

切换到 rolldown-vite 后，整体平均构建时间为 2317.75 ms, 构建热更新平均构建时间为 887.56 ms

