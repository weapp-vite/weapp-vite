# 完整质量 job 的执行预算

固定提交 `1b7f710e4a2384991a83b81f740b30fda7787aaa` 的完整质量运行 `36915289292` 中，macOS Node 24 job `110581640990` 最终被取消。GitHub annotation 明确报告 `The job has exceeded the maximum execution time of 40m0s`。

该 job 于 21:25:41 UTC 启动。构建、lint 和测试所在的 Run command 于 22:03:14 成功；测试汇总为 1348 个文件通过、25 个跳过，12591 项测试通过、31 项跳过。随后 Codecov 步骤终态成功，但其日志保留 protected branch 需要 token 的上传诊断，不宣称覆盖率上传已成功。

22:03:33 开始的 setup-node post action 使用 tar/zstd 压缩 pnpm 缓存；22:05:48 收到超时取消。失败发生在测试命令完成后的缓存收尾，不能归为测试断言失败，也不能把整个旧运行改称通过。

GitHub 的 job timeout 覆盖初始化、安装、质量命令和 post action。原 macOS 完整矩阵使用 40 分钟，在本次约 38 分钟的前置工作之后，只剩约两分钟完成缓存保存。完整 Windows 矩阵已经使用 60 分钟。现在 macOS 的 Node 22/24 完整矩阵也采用 60 分钟，给相同阶段保留收尾预算；普通 PR 矩阵及测试自身的超时、断言、执行顺序均不变。

此项仅调整 CI 资源预算，无产品行为变化，不需要 changeset，也不需要重建产品 dist。通过 YAML 结构比较确认仅两个完整 macOS 项的预算变化，运行定向 ESLint 和现有 workflow 类型契约检查。旧运行及原始日志保留；修正后的完整质量运行必须针对新提交执行，不能以本地验证替代远端终态。
