# Windows 标准宿主路径诊断与修复

## 原始证据

完整矩阵中的库声明输入使用短路径，tsconfig/cwd 使用真实路径，导致声明生成失败。PR #1150 首次修复声明路径后，classic dev 暴露第二个失败：Node 24.18.0 的 libuv `src/win/fs-event.c:72` 断言退出。

- 原始监听失败：[Host paths](https://github.com/weapp-vite/weapp-vite/actions/runs/36811184182/job/110206376039)，29 项声明/会话单测通过，classic dev 导致 worker 退出。
- 独立原生对照：[Native path controls](https://github.com/weapp-vite/weapp-vite/actions/runs/36814378243/job/110216153550)，提交 `110404c4847d9d56f086e9c3357e751318aeec5f`。

独立对照未安装 weapp 插件，结果如下：

| 输入 | 结果 |
| --- | --- |
| 原始临时目录路径，纯 Node fs.watch | 相同 libuv 断言，退出码 3221226505 |
| realpath 后的目录，纯 Node fs.watch | 收到文件事件 |
| 整个 node_modules 目录 junction | 调用 Vite 前 access 包入口即 ENOENT |
| 逐依赖链接到真实目录 | access 与原生 Vite 构建通过 |

React 的失败发生在框架解析前，属于夹具链接布局问题；不能通过给产品注入 React 别名或 external 配置来隐藏它。

## 编译会话修复

Vite 默认 realpath 项目 root，但此前编译会话在宿主解析前开始扫描并保留原始 cwd，侧车监听和子构建因此可能继续使用另一条目录身份。目录别名回归明确复现 compiler cwd 与 Vite root 不一致；显式 preserveSymlinks 对照本来一致。

会话准备阶段现在遵循同一根目录策略，并把同一 root 传给子构建；不改用 polling，不手写构建产物，不搬迁原始短路径 classic-dev 回归。显式 preserveSymlinks 仍保留别名语义。别名专用用例从真实父目录创建别名，单独验证别名语义；原 classic-dev 用例继续使用系统提供的临时路径，覆盖短路径。

## 诊断与验收边界

原始失败输入保留为独立命令，失败仍输出非零退出码：

```sh
node packages/weapp-vite/scripts/diagnose-native-host-paths.mjs
```

该命令描述未经框架适配的 Node/文件系统能力，不代表已修好 Node 本身。正常门禁保留 canonical fs.watch、有效依赖链接、实际框架构建/监听、目录别名和 preserveSymlinks 回归。未经适配的失败输入没有改写为通过或忽略返回值。

本机修复后的声明/会话/库构建监听回归、公开类型、重建和打包 Vite 消费链已通过；打包消费包含 dev/build-watch/stateful 与库组件 headless 挂载、点击、重入。Windows 新 HEAD 门禁和真实 DevTools 最终验收仍需分别完成，历史结果不能代替新 HEAD。
