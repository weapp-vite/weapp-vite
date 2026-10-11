# CI 资源初始化与文件描述符限制

Windows 的 `automator-launch-resilience` 在 Vitest 全局初始化阶段失败：尚未加载用例中的 mock，就因真实 IDE journal 的进程身份查询超过 10 秒而退出。同提交的 Ubuntu 用例通过。测试发现失败是后续提示，最早故障不是缺少测试文件。

CI、CI build-only 与 HMR guard 的用例只使用构建、文件 watcher、headless provider 或 mock，不启动真实 IDE。这三个配置改用已有的机器互斥初始化：仍与其他 E2E 串行，worker 不继承真实 IDE journal，也不额外查询原生 IDE 身份。外层 runner 的资源 scope 与清理流程保留；真实 DevTools 配置继续使用完整初始化，身份查询失败仍拒绝启动。

回归通过配置实际指定的 setup 运行，在原生 IDE 查询不可用时验证 CI 仍持有可释放的独占机器租约，并验证真实 DevTools 配置拒绝继续。原 Windows 失败文件的 78 项用例及相关配置、清单、资源初始化检查已在本机通过；Windows 远端结果仍需重新验证。外层嵌套 HMR 命令也出现过身份查询超时，本次配置变更不能证明该独立路径已解决。

另一个独立配置问题是 reusable workflow 在单独的 shell step 中执行 `ulimit`。限制不会传给主命令的新 shell，因此将原有 opt-in 调整移入主命令所在的 bash，并记录生效值，仍排除 Windows。尚无 EMFILE 证据，不能将它认定为 HMR 性能超限的原因。
