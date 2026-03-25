# @mpcore/simulator

`@mpcore/simulator` 是 `mpcore` 生态中的 headless 小程序运行时与测试内核。

当前主要能力：

- 直接执行构建后的小程序产物
- 提供 `App/Page/Component/getApp/getCurrentPages/wx` 的最小宿主模拟
- 提供面向 e2e/runtime 断言的页面启动、重启与 WXML 查询能力
