# Doctor

`wv doctor` / `runDoctor`（来自 `weapp-vite/doctor`）共享只读事实检查引擎，分别记录 project/source/artifact/runtime 覆盖。默认读取项目 JSON 和 `src`，不执行配置、不启动 IDE、不上传数据或修改代码。其他源码目录须显式传入 `--source`；构建模式会使用实际编译源码目录。

```sh
wv doctor --format json
wv doctor --build --targets weapp,alipay,swan,tt,xhs
wv doctor --artifact dist --platform weapp --format sarif
wv doctor --runtime --platform weapp
```

`--build` 明确允许执行配置/插件，在独立子进程中通过正常编译器生成 `.weapp-vite/doctor` 下的最终产物，再读取快照。构建日志走 stderr，不污染 JSON/SARIF。报告包含实际相对目录、文件摘要和预算。与 `--artifact` 互斥，后者标记新鲜度未验证、缺失编译预算时 incomplete。

`--runtime` 只连接已打开的微信 DevTools 项目并读取 Tool.getInfo 与当前页面，不启动 IDE、不切换路由；已有非默认 automator 会话可使用 `--runtime-port <port>`。这不代表应用功能已经通过 E2E。其他宿主无探针、连接失败或未打开项目均为 incomplete。


宿主分层证据会保留 CLI 可执行条件、指定服务监听、登录查询与登录状态、项目连接、工具信息、当前页面以及本次连接释放的独立结果。`passed`、`failed`、`unknown`、`not-run` 分开记录；部分失败仍保留成功阶段、实际 IDE/SDK 版本和脱敏证据，退出码为 2。TCP 可达只证明有监听，不证明它属于所选 IDE；Tool.getInfo/页面快照也不证明完整应用功能已通过。

- `--runtime-cli <path>`：只读检查显式选择的 CLI，不执行、不回退其他安装。
- `--runtime-service-port <port>`：连接指定回环 TCP 端口检查监听，仅释放本次 socket。
- `--runtime-login`：单独允许执行原生 islogin，需要同时传入 `--runtime-cli`；原生 CLI 可能启动 IDE。没有此开关不会查询或推断登录状态。

上述选项都需要 `--runtime`。JSON/SARIF 中的 `runtime.<target>.bundle` 包含框架/Node 版本、可取得的 IDE/基础库版本、配置选择摘要、最后成功阶段、有限的固定分类事件及通用复现命令。未知版本省略，终端显示 unknown；不保存原始 Tool.getInfo、CLI 输出、凭据、绝对路径或页面查询参数，不自动上传。`not-run` 不代表检查通过；旧的自定义 runtime adapter 仍可使用原证据结构。

连接和页面/工具 RPC 有界等待，迟到连接只断开自身 websocket，迟到 RPC 不会改写已返回的报告。完整操作层的总 deadline、分类重试和跨进程取消由相应操作层负责；此探针不替代 #1141 的完整工作。

退出码：0 为请求范围完整且无错误；1 为发现门禁错误；2 为未完成或执行失败（优先于 1）。未请求的层标为 not-requested。

复用平台注册表、ESLint 兼容规则和包体预算。非微信平台不使用微信 API 基线；尚无完整 API 目录时相应层 incomplete。HarmonyOS 等设备系统不作为编译目标别名。源码风险与产物诊断分离；动态引用、外部插件、自定义 npm 输出等事实不足的范围不判定通过。

产物检查包含页面/组件文件与引用、静态脚本/模板/样式依赖、独立分包边界、worker 目录和预算。诊断包含稳定 ruleId、location、evidence、responsibility、fingerprint、suggestion。无法确定责任时保留 unknown；confirmed 仅指当前静态契约的确定违反，不代表已确认框架 bug。报告只保留产物字节数与摘要，不附带完整源码。工具不会自动发布报告或创建 issue。

```ts
import { formatDoctorReport, runDoctor } from 'weapp-vite/doctor'

const report = await runDoctor({ cwd: '.', build: true, targets: ['weapp'] })
const json = formatDoctorReport(report, 'json')
```
