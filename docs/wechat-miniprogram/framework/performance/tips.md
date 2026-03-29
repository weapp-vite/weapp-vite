<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips.html -->

# 运行时性能

小程序的运行时性能直接决定了用户在使用小程序功能时的体验。如果运行时性能出现问题，很容易出现页面滚动卡顿、响应延迟等问题，影响用户使用。如果内存占用过高，还会出现黑屏、闪退等问题。

在优化运行时性能前，建议开发者先了解下小程序的 [运行环境](../runtime/env.md) 和 [运行机制](../runtime/operating-mechanism.md) 。

开发者可以从以下方面着手进行启动性能的优化：

- [合理使用 setData](./tips/runtime_setData.md)
- [渲染性能优化](./tips/runtime_render.md)
- [页面切换优化](./tips/runtime_nav.md)
- [资源加载优化](./tips/runtime_resource.md)
- [内存优化](./tips/runtime_memory.md)
