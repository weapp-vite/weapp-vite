<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/start_optimizeD.html -->

# 其他启动性能优化建议

除了 [代码包体积](./start_optimizeA.md) 、 [代码注入](./start_optimizeB.md) 、 [首屏渲染](./start_optimizeC.md) 之外，发版频率等因素也会影响小程序启动耗时。

针对这些因素，我们建议开发者：

## 1. 合理规划版本发布

小程序启动时如果检测到版本更新（具体策略请参考 [小程序更新机制](../../runtime/update-mechanism.md) ），会进行以下操作，影响启动耗时

- 重新获取小程序的基础信息
- 进行小程序代码包的增量更新
- 重新生成 JS 代码的 Code Cache
- 重新生成初始渲染缓存

能够快速迭代发布是小程序相对 APP 的一个优势，但是过于频繁的新版本发布可能会导致部分用户每次使用都需要进行小程序的更新，导致平均启动耗时变长。

在不影响小程序正常功能迭代的前提下，我们建议开发者提前做好版本规划，控制版本发布的频率。

> 回退和发布新版本对于启动耗时的影响是一致的。
