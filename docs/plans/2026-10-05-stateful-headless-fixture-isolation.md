# Stateful HMR headless 项目隔离

## 问题与证据边界

默认 headless suite 原先直接编辑 `e2e-apps/stateful-hmr/src` 并构建到共享的 `dist`。保留的手动 IDE 也可能读取此输出，因此即使 E2E 命令串行，两个客户端仍可能使用同一个 HMR 服务。

本轮曾观察到 headless 客户端停留在版本 0 和 HTTP 409，但后续双场景复跑未稳定复现。真实 IDE 双场景、随后共享目录的 headless 双场景，以及重新打开原 IDE 窗口后的复跑均通过。现有证据只能确认共享目录存在干扰风险，不能把此前 409 归因于手动 IDE，也不能据此改变 HMR 协议。

## 实现选择

- 默认 headless suite 在 `.tmp/e2e-projects` 下创建唯一目录，仅复制 fixture 源码、公开资源和必需配置，排除生成物与缓存。
- 临时项目链接 workspace 的 `weapp-vite` 与 `wevu`，仍通过原 workspace CLI 启动，保持真实构建流程和 dist 同步要求。
- 显式 `WEAPP_VITE_E2E_STATEFUL_PROJECT` 继续使用调用方提供的发布消费者项目与隔离 CLI 解析；真实 DevTools 的默认项目路径保持原有契约。
- cleanup 只处理本次创建且目录身份仍一致的项目，不跟随替换后的链接，不删除其他项目或共享依赖；重复和并发调用共享一次清理任务。
- teardown 在传输关闭失败时仍执行本次 dev 进程的 stop；stop 失败会保留项目，不删除仍可能被使用的目录。

## 验证

helper 单测覆盖源码和输出隔离、生成物排除、依赖解析、重复与并发清理、目录被替换、链接被替换，以及准备失败后的独占资源回收。该单测纳入根 Vitest 的基础设施清单。

runtime 验收继续使用原有严格断言，分别验证 headless 与真实 DevTools。运行结果进入本轮验收报告；本设计记录不以 helper 单测替代 runtime 验收。

## 文件规模

原 runtime suite 已超过 300 行。本次将项目复制和目录所有权提取到独立 helper，保留现有场景、顺序与断言，避免在基础设施隔离变更中同时重构 runtime 场景。
