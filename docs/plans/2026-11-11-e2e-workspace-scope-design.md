# 全仓回归的专项 workspace 范围

本轮全面回归排除 `uview-plus-compat` 和 `wot-ui-compat`。既有 `WEAPP_VITE_E2E_EXCLUDE_PROJECTS` 已过滤 IDE、headless、Web 和专项用例，但根构建、lint 及通用 CI 没有接收同一范围，导致独立专项应用仍被选中。

根 Turbo 构建和 lint 入口复用项目名校验，按目录追加排除过滤器。过滤参数放在 `--` 之前，避免被传给包脚本；Windows 构建包装器读取实际子进程环境并采用相同规则。直接通过 Node 执行 Turbo 的 JavaScript 入口，避免依赖 Windows `.cmd` 和 shell 解析。未设置环境变量时，命令的包选择不变。

手动 CI 增加可选范围输入，经质量平台传给所有子 job。原生 PR 和定时 CI 保持空默认值；CI E2E 沿用已有输入。通用编译器、运行时与 simulator 不在目录排除范围内，继续接受全部相关测试。

验证包含工作流范围传递、Windows 子进程环境、包脚本参数边界，以及真实 Turbo dry-run 的默认/排除包集比较。完整 IDE 在同步、干净的主线提交上重新执行，取消的阶段运行保留原报告，不计全量通过。
