# IDE E2E 显式渠道选择

用户已明确要求在升级后的 Nightly 继续 IDE Goal。此前验收默认 Stable，预检即使接受精确版本也拒绝 Nightly；直接改默认渠道会混淆历史 Stable 与新结果。

采用进程级显式渠道授权：`WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL=nightly`，同时要求 `WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION` 为完整产品版本。渠道默认为 `stable`；RC 同样必须同时授权渠道与精确版本。未知渠道、版本不一致、官方查询失败以及实际宿主身份不一致均停止。相比改默认渠道或绕过预检，这一方案保留原默认契约，也允许复现用户指定版本。

预检继续查询官方 Stable 作为对照，通过固定 CLI 读取安装真实渠道与版本。报告的 `selectedChannel` 记录实际选择，`selected-version-opt-in` 记录显式版本例外；只有 Stable 渠道且版本匹配才设置 `officialVersionMatches=true`。序列化验证拒绝将 Nightly 或 RC 宣称为 `official-stable`。真实协议报告的 IDE 与基础库版本仍独立核验。

资源治理不变：全机串行租约、冷宿主认领、每个 suite 复用 automator，通过 `reLaunch` 切页，任务结束后按登记所有权关闭窗口及宿主。新报告单独保存，不覆盖历史 Stable 失败。

验证先覆盖默认 Stable、无渠道授权、精确渠道/版本授权、渠道及版本漂移、未知渠道、网络失败和序列化伪造。随后在同一提交按正式入口运行 8 项 `ide-gate`、23 项 `ide-full`，继续排除 uview plus 和 wot-ui，不扩展 exhaustive，不改变 runtime 断言。
