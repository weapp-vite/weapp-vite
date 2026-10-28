# Stateful 宿主格式回归

此 fixture 覆盖 issue #1275。`e2e/utils/statefulHostFormatProject.ts` 使用真实 Rolldown 分块及生产 `createStatefulHmrHostFormatPlugin` 构建独占原生项目，JSON/WXML 通过 bundler 的资产接口输出。

当前微信启动策略会将 stateful 模式回退为 classic，因此这里直接验证宿主格式转换的产物，避免普通 CLI 构建绕过待测路径；此 fixture 不修改或放宽启动策略。

`e2e/ide/stateful-host-format.runtime.test.ts` 在 headless 和真实 DevTools 使用相同断言，覆盖首屏、异步加载、缓存与共享状态、模块求值失败。IDE 最终验收不能由 headless 结果替代。
