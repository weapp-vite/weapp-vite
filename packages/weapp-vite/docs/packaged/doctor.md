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

退出码：0 为请求范围完整且无错误；1 为发现门禁错误；2 为未完成或执行失败（优先于 1）。未请求的层标为 not-requested。

复用平台注册表、ESLint 兼容规则和包体预算。非微信平台不使用微信 API 基线；尚无完整 API 目录时相应层 incomplete。HarmonyOS 等设备系统不作为编译目标别名。源码风险与产物诊断分离；动态引用、外部插件、自定义 npm 输出等事实不足的范围不判定通过。

产物检查包含页面/组件文件与引用、静态脚本/模板/样式依赖、独立分包边界、worker 目录和预算。诊断包含稳定 ruleId、location、evidence、responsibility、fingerprint、suggestion。无法确定责任时保留 unknown；confirmed 仅指当前静态契约的确定违反，不代表已确认框架 bug。报告只保留产物字节数与摘要，不附带完整源码。工具不会自动发布报告或创建 issue。

```ts
import { formatDoctorReport, runDoctor } from 'weapp-vite/doctor'

const report = await runDoctor({ cwd: '.', build: true, targets: ['weapp'] })
const json = formatDoctorReport(report, 'json')
```
