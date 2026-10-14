# Vite 宿主能力探测退出诊断

PR #1190 的 `8ac9ced` 首轮中，Web browser runtime（wv）前置 `probe-host.mjs` 输出能力检查成功，随后被父命令原有 120 秒期限以 SIGKILL 终止。探测仅导入消费者 Vite/Rolldown、创建 bundled middleware server 并关闭，不加载 weapp 插件，尚未进入真实浏览器断言。同轮 vite 和 vite-plus 已完成浏览器验证；历史失败保持保留。

本机使用 Node 24.18.0、新 npm 安装的 Vite 8.3.4 / Rolldown 1.2.13 做了一次带阶段观察的最小探测：创建约 28ms、关闭完成约 37ms、自然退出约 39ms。该结果没有复现原 CI 卡住，也不证明产品已修复。源码中 bundled native 初始 run 与关闭可能重叠，只能作为后续诊断方向，尚未建立因果关系。

独立诊断分支通过既有 manual-only `web-consumer-diagnostic.yml` 启用 `WEAPP_VITE_CONSUMER_HOST_DIAGNOSTICS=1`。探测输出固定 JSON 阶段：引擎导入、服务器创建、能力断言、关闭开始/完成、主体完成和正常 exit。父命令保存 child 原结果与这些阶段至既有 `.cache/web-consumer-diagnostic` artifact；阶段仅含名称、同进程 elapsedMs 和可选 exit code，不保存路径、argv、环境或任意错误文本。截断行单独计数，保留前面的完整阶段。

保留原 120 秒、SIGKILL、maxBuffer、createServer 配置、方法断言与调用顺序。无新等待、预热、重试、强制退出或资源清理。阶段输出或 artifact 保存失败不能阻止原关闭、替换原错误或把成功 child 改成失败；窄故障注入测试覆盖这些边界。

诊断的 `close-start` 无 `close-complete` 可缩小到关闭等待；有关闭完成但父命令超时且无正常 exit，提示关闭后仍未退出。两种情形都不等价于浏览器断言失败。本轮仅补观察面，不撤销首次失败或替代正式 CI 完整通过。

独立 CI 诊断首次执行完成九个有序阶段：创建约 41.40ms、关闭约 17.02ms、主体约 59.94ms、自然退出约 60.73ms；随后原 Chromium 更新和恢复场景通过。没有复现此前 120 秒失败，尚无唯一根因。现在把同一可选阶段记录接入原三宿主 Web CI，保持原命令参数、矩阵和期限，并通过既有 `always()` 上传失败前的探测 JSON。该 CI 不启用浏览器 watcher 诊断插件，不增加启动、采样或重试；通过也不能证明历史波动消除。
