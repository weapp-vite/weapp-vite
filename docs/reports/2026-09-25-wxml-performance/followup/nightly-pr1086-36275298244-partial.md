# PR #1086 Nightly：首批 25/27 分片核验

🔴 [Nightly 36275298244](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244) 尚在运行，首批 25 个分片已下载并复算。Windows/macOS auto-hmr 两片尚未收齐；下表不是完整最终门禁。已确认的回退、缺样本及生命周期错误不会因其他指标通过而消除。

- 冻结目标：#1086 `e0803dc451ee628244d7aad1bda97e1c627587ea`，不包含 #1085。
- 可信 driver：`d657d7b64bf2e5fb367862377255d513dab0ec07`；固定基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 契约 key：`7fcaab35112a926ff80eb77e51fc6cfe4537c79f8b992938450ba1da629be56f`。
- main 和 #1085 仅复用原失败结果，本轮没有重跑。构建 7 对、HMR 20 对交替串行，超过 5% 仅一次等量确认；未改阈值、基线、轮询或样本。
- verifyShard 核查身份、冻结分片、两侧 SHA、清单、顺序、样本完整性、产物与确认计划，并逐项复算状态和统计。结构有效不代表性能通过。

## 当前已核验指标

| OS | passed | regression | unstable | incomplete |
| --- | ---: | ---: | ---: | ---: |
| ubuntu-latest | 109 | 30 | 3 | 8 |
| windows-latest | 96 | 7 | 3 | 12 |
| macos-latest | 72 | 10 | 31 | 5 |

## 分片与生命周期错误

错误条数包括外层采集错误及子场景详情，不等于独立失败次数。完整错误保留在 JSON；目标指标完整不能覆盖同片前置发布/恢复错误。

| 分片 | 场景 | 全局状态 | 指标 pass/reg/unstable/incomplete | 首批/确认错误条数 |
| --- | --- | --- | --- | --- |
| [macos-0](./nightly-pr1086-36275298244-macos-0.json.gz) | `build` | unstable | 3/0/3/0 | 0/0 |
| [macos-1](./nightly-pr1086-36275298244-macos-1.json.gz) | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | unstable | 14/0/2/0 | 0/0 |
| [macos-2](./nightly-pr1086-36275298244-macos-2.json.gz) | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | regression | 12/1/2/1 | 0/2 |
| [macos-3](./nightly-pr1086-36275298244-macos-3.json.gz) | `hmr:classic:weapp-vite-template` | unstable | 12/0/4/0 | 0/0 |
| [macos-4](./nightly-pr1086-36275298244-macos-4.json.gz) | `hmr:stateful-experimental:weapp-vite-template` | regression | 10/2/4/0 | 0/0 |
| [macos-5](./nightly-pr1086-36275298244-macos-5.json.gz) | `hmr:classic:weapp-vite-wevu-template` | incomplete | 4/0/8/4 | 40/40 |
| [macos-6](./nightly-pr1086-36275298244-macos-6.json.gz) | `hmr:stateful-experimental:weapp-vite-wevu-template` | regression | 12/1/3/0 | 0/0 |
| [macos-7](./nightly-pr1086-36275298244-macos-7.json.gz) | `auto-build` | regression | 5/6/5/0 | 0/0 |
| [ubuntu-0](./nightly-pr1086-36275298244-ubuntu-0.json.gz) | `build` | passed | 6/0/0/0 | 0/0 |
| [ubuntu-1](./nightly-pr1086-36275298244-ubuntu-1.json.gz) | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | passed | 16/0/0/0 | 0/0 |
| [ubuntu-2](./nightly-pr1086-36275298244-ubuntu-2.json.gz) | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | incomplete | 12/0/0/4 | 2/0 |
| [ubuntu-3](./nightly-pr1086-36275298244-ubuntu-3.json.gz) | `hmr:classic:weapp-vite-template` | unstable | 14/0/2/0 | 0/0 |
| [ubuntu-4](./nightly-pr1086-36275298244-ubuntu-4.json.gz) | `hmr:stateful-experimental:weapp-vite-template` | unstable | 15/0/1/0 | 0/0 |
| [ubuntu-5](./nightly-pr1086-36275298244-ubuntu-5.json.gz) | `hmr:classic:weapp-vite-wevu-template` | regression | 11/1/0/4 | 40/40 |
| [ubuntu-6](./nightly-pr1086-36275298244-ubuntu-6.json.gz) | `hmr:stateful-experimental:weapp-vite-wevu-template` | regression | 12/4/0/0 | 0/4 |
| [ubuntu-7](./nightly-pr1086-36275298244-ubuntu-7.json.gz) | `auto-build` | passed | 16/0/0/0 | 0/0 |
| [ubuntu-8](./nightly-pr1086-36275298244-ubuntu-8.json.gz) | `auto-hmr` | regression | 7/25/0/0 | 0/0 |
| [windows-0](./nightly-pr1086-36275298244-windows-0.json.gz) | `build` | unstable | 4/0/2/0 | 0/0 |
| [windows-1](./nightly-pr1086-36275298244-windows-1.json.gz) | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | passed | 16/0/0/0 | 0/0 |
| [windows-2](./nightly-pr1086-36275298244-windows-2.json.gz) | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | incomplete | 12/0/0/4 | 2/0 |
| [windows-3](./nightly-pr1086-36275298244-windows-3.json.gz) | `hmr:classic:weapp-vite-template` | unstable | 15/0/1/0 | 0/0 |
| [windows-4](./nightly-pr1086-36275298244-windows-4.json.gz) | `hmr:stateful-experimental:weapp-vite-template` | incomplete | 12/0/0/4 | 2/0 |
| [windows-5](./nightly-pr1086-36275298244-windows-5.json.gz) | `hmr:classic:weapp-vite-wevu-template` | incomplete | 12/0/0/4 | 40/0 |
| [windows-6](./nightly-pr1086-36275298244-windows-6.json.gz) | `hmr:stateful-experimental:weapp-vite-wevu-template` | regression | 12/4/0/0 | 0/0 |
| [windows-7](./nightly-pr1086-36275298244-windows-7.json.gz) | `auto-build` | regression | 13/3/0/0 | 0/0 |

本批生命周期错误中，Ubuntu stateful TDesign 首批第 7 对 baseline 脚本发布及恢复超时；Windows TDesign 第 8 对、原生模板第 17 对 baseline 脚本发布超时（后者也恢复超时）；macOS TDesign 确认第 10 对 baseline 脚本超时；Ubuntu stateful Wevu 确认第 1、5 对 baseline 脚本超时。classic Wevu 的基线 sitemap 缺项继续单列，不因优化侧结果完整改写为可比较。

当前已确认 47 项回退。Ubuntu/Windows stateful Wevu 模板四项在两批确认中约增加 79%–98%；Ubuntu auto-hmr 有 25 项确认回退。相比单次百分比，这些模式值得优先定位，但尚不能排除 OS/启动/文件系统因素，或认定同一代码改动是全部原因。

## 确认回退

以下均为原契约中的两批确认回退；不能仅凭跨历史基线的差异归因本 PR 单项修改，也不能用中位数相减虚构阶段耗时。

| OS | 指标 | 首批变化 | 确认变化 |
| --- | --- | ---: | ---: |
| macos-latest | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | +7.2731% | +7.8910% |
| macos-latest | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | +16.9723% | +25.2482% |
| macos-latest | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | +7.2346% | +15.0515% |
| macos-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | +7.4238% | +21.9403% |
| macos-latest | `auto-build:1:manual:repeat` | +18.3312% | +6.1914% |
| macos-latest | `auto-build:20:manual:first` | +17.6812% | +14.6012% |
| macos-latest | `auto-build:20:manual:repeat` | +12.3697% | +9.2584% |
| macos-latest | `auto-build:20:automatic:first` | +34.2159% | +13.1136% |
| macos-latest | `auto-build:50:automatic:repeat` | +6.0172% | +9.6040% |
| macos-latest | `auto-build:69:manual:first` | +17.6619% | +7.6660% |
| ubuntu-latest | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | +6.8883% | +6.6190% |
| ubuntu-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | +86.7319% | +92.2798% |
| ubuntu-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | +86.3083% | +79.2882% |
| ubuntu-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | +95.3424% | +89.9031% |
| ubuntu-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | +84.0348% | +83.3270% |
| ubuntu-latest | `auto-hmr:1:manual:first:edit` | +47.9861% | +50.3182% |
| ubuntu-latest | `auto-hmr:1:automatic:first:edit` | +56.1816% | +56.6272% |
| ubuntu-latest | `auto-hmr:20:manual:first:edit` | +52.5075% | +53.6282% |
| ubuntu-latest | `auto-hmr:20:manual:first:restore` | +65.7765% | +66.3905% |
| ubuntu-latest | `auto-hmr:20:manual:repeat:edit` | +115.0963% | +108.0130% |
| ubuntu-latest | `auto-hmr:20:manual:repeat:restore` | +12.7059% | +11.8276% |
| ubuntu-latest | `auto-hmr:20:automatic:first:edit` | +52.5921% | +56.8435% |
| ubuntu-latest | `auto-hmr:20:automatic:repeat:edit` | +92.2981% | +63.0237% |
| ubuntu-latest | `auto-hmr:20:automatic:repeat:restore` | +31.2930% | +33.1609% |
| ubuntu-latest | `auto-hmr:50:manual:first:edit` | +58.8072% | +57.3960% |
| ubuntu-latest | `auto-hmr:50:manual:first:restore` | +99.9267% | +103.6544% |
| ubuntu-latest | `auto-hmr:50:manual:repeat:edit` | +80.7314% | +84.3584% |
| ubuntu-latest | `auto-hmr:50:manual:repeat:restore` | +59.6252% | +61.0874% |
| ubuntu-latest | `auto-hmr:50:automatic:first:edit` | +52.8691% | +49.9660% |
| ubuntu-latest | `auto-hmr:50:automatic:first:restore` | +76.9575% | +76.1241% |
| ubuntu-latest | `auto-hmr:50:automatic:repeat:edit` | +111.8532% | +115.4302% |
| ubuntu-latest | `auto-hmr:50:automatic:repeat:restore` | +107.1608% | +108.8200% |
| ubuntu-latest | `auto-hmr:69:manual:first:edit` | +53.2886% | +50.8512% |
| ubuntu-latest | `auto-hmr:69:manual:first:restore` | +107.3374% | +107.1751% |
| ubuntu-latest | `auto-hmr:69:manual:repeat:edit` | +85.8652% | +86.7390% |
| ubuntu-latest | `auto-hmr:69:manual:repeat:restore` | +90.3136% | +89.2786% |
| ubuntu-latest | `auto-hmr:69:automatic:first:edit` | +57.7051% | +55.7415% |
| ubuntu-latest | `auto-hmr:69:automatic:first:restore` | +78.4223% | +77.7610% |
| ubuntu-latest | `auto-hmr:69:automatic:repeat:edit` | +67.5371% | +66.6619% |
| ubuntu-latest | `auto-hmr:69:automatic:repeat:restore` | +70.3066% | +66.7487% |
| windows-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | +83.1200% | +89.1110% |
| windows-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | +84.2328% | +97.5415% |
| windows-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | +81.1713% | +83.7346% |
| windows-latest | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | +92.5853% | +85.9781% |
| windows-latest | `auto-build:1:manual:repeat` | +8.3438% | +22.9249% |
| windows-latest | `auto-build:1:automatic:first` | +19.3103% | +21.3724% |
| windows-latest | `auto-build:1:automatic:repeat` | +10.7531% | +16.5197% |

## 所有指标

| 分片 | 指标 | 状态 | 首批变化 | 确认变化 |
| --- | --- | --- | ---: | ---: |
| macos-0 | `build:weapp-vite-tailwindcss-tdesign-template:first` | passed | -1.6893% | — |
| macos-0 | `build:weapp-vite-tailwindcss-tdesign-template:repeat` | passed | +3.8407% | — |
| macos-0 | `build:weapp-vite-template:first` | unstable | +6.8114% | -1.3857% |
| macos-0 | `build:weapp-vite-template:repeat` | unstable | +7.7840% | -3.7255% |
| macos-0 | `build:weapp-vite-wevu-template:first` | unstable | +17.2481% | +4.6396% |
| macos-0 | `build:weapp-vite-wevu-template:repeat` | passed | +2.3717% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | -6.6757% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | -0.7803% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | -0.3340% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | +1.6348% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | passed | -0.1234% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | passed | -5.7027% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | passed | -1.7876% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | passed | +0.9124% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | unstable | +6.8832% | +1.1031% |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +4.7650% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | -2.7592% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | +2.6355% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | unstable | +6.8118% | +2.0797% |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | -1.4666% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +0.7899% | — |
| macos-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | -3.5806% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | +4.6707% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | +2.1118% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | -5.9757% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | -0.3490% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | incomplete | +8.2259% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | passed | +1.4046% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | passed | +2.8976% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | passed | -23.2456% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | -2.0699% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | regression | +7.2731% | +7.8910% |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | unstable | +13.1125% | -2.4895% |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | +1.7421% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | +2.7765% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | unstable | +5.0796% | +2.0178% |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | -0.4410% | — |
| macos-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | -1.6356% | — |
| macos-3 | `hmr:classic:weapp-vite-template:app-json:first:edit` | unstable | +6.7370% | -0.4551% |
| macos-3 | `hmr:classic:weapp-vite-template:app-json:first:restore` | unstable | +6.4441% | -2.5928% |
| macos-3 | `hmr:classic:weapp-vite-template:app-json:repeat:edit` | passed | +2.3793% | — |
| macos-3 | `hmr:classic:weapp-vite-template:app-json:repeat:restore` | unstable | +10.9171% | -1.2853% |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-script:first:edit` | passed | +4.3467% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-script:first:restore` | unstable | +7.2795% | +1.1578% |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | passed | -2.1294% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:restore` | passed | +0.0483% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-template:first:edit` | passed | -1.5969% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-template:first:restore` | passed | +0.1752% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:edit` | passed | -3.8255% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:restore` | passed | -5.1750% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-style:first:edit` | passed | -2.7074% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-style:first:restore` | passed | -6.4667% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:edit` | passed | -2.7732% | — |
| macos-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | passed | +1.4888% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:edit` | passed | +1.2259% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:restore` | unstable | +14.6829% | +4.5273% |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:edit` | unstable | +11.0017% | +1.0795% |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:restore` | passed | -3.3641% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | passed | -8.9856% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:restore` | unstable | +5.0548% | +0.7899% |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | regression | +16.9723% | +25.2482% |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:restore` | passed | +4.0513% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | passed | +1.5122% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:restore` | passed | -3.1362% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | regression | +7.2346% | +15.0515% |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:restore` | passed | -2.8510% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:edit` | passed | +2.8477% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:restore` | unstable | +6.0575% | -6.2146% |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | passed | +1.0377% | — |
| macos-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:restore` | passed | -4.4701% | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | unstable | +9.9827% | -1.4695% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | unstable | +5.6173% | +2.5740% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | unstable | +16.0887% | +3.7802% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | unstable | +9.8951% | -0.1275% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | unstable | +10.5886% | +2.2862% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | -0.0269% | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | +3.3496% | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | +0.8120% | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | unstable | +7.6468% | +3.6633% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:restore` | unstable | +5.6465% | -5.6333% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | unstable | +5.0018% | +3.8173% |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | passed | +0.4824% | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | incomplete | — | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | incomplete | — | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | incomplete | — | — |
| macos-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | incomplete | — | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | -19.8288% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | unstable | +10.6965% | -4.5500% |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | -14.0221% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | -14.9031% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | -4.0693% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | -2.5588% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | -10.6221% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | -1.4764% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | unstable | +9.6884% | -0.5548% |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | passed | -4.1227% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | regression | +7.4238% | +21.9403% |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | passed | +4.5173% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:edit` | passed | -4.4989% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:restore` | passed | -1.9170% | — |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:edit` | unstable | +7.1834% | -2.1048% |
| macos-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:restore` | passed | -1.7804% | — |
| macos-7 | `auto-build:1:manual:first` | unstable | +10.0266% | -0.0562% |
| macos-7 | `auto-build:1:manual:repeat` | regression | +18.3312% | +6.1914% |
| macos-7 | `auto-build:1:automatic:first` | passed | +2.4364% | — |
| macos-7 | `auto-build:1:automatic:repeat` | unstable | +30.3111% | -10.6904% |
| macos-7 | `auto-build:20:manual:first` | regression | +17.6812% | +14.6012% |
| macos-7 | `auto-build:20:manual:repeat` | regression | +12.3697% | +9.2584% |
| macos-7 | `auto-build:20:automatic:first` | regression | +34.2159% | +13.1136% |
| macos-7 | `auto-build:20:automatic:repeat` | unstable | +5.5096% | +1.9300% |
| macos-7 | `auto-build:50:manual:first` | passed | +1.2177% | — |
| macos-7 | `auto-build:50:manual:repeat` | unstable | +6.0071% | -1.0160% |
| macos-7 | `auto-build:50:automatic:first` | unstable | +7.1162% | -14.8269% |
| macos-7 | `auto-build:50:automatic:repeat` | regression | +6.0172% | +9.6040% |
| macos-7 | `auto-build:69:manual:first` | regression | +17.6619% | +7.6660% |
| macos-7 | `auto-build:69:manual:repeat` | passed | -5.3972% | — |
| macos-7 | `auto-build:69:automatic:first` | passed | +1.1874% | — |
| macos-7 | `auto-build:69:automatic:repeat` | passed | -16.9879% | — |
| ubuntu-0 | `build:weapp-vite-tailwindcss-tdesign-template:first` | passed | -0.1484% | — |
| ubuntu-0 | `build:weapp-vite-tailwindcss-tdesign-template:repeat` | passed | -0.0120% | — |
| ubuntu-0 | `build:weapp-vite-template:first` | passed | +0.8981% | — |
| ubuntu-0 | `build:weapp-vite-template:repeat` | passed | +0.2524% | — |
| ubuntu-0 | `build:weapp-vite-wevu-template:first` | passed | +0.7661% | — |
| ubuntu-0 | `build:weapp-vite-wevu-template:repeat` | passed | -0.0778% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | +4.1704% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | +2.8960% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | +0.5097% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | +4.5314% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | passed | +0.4980% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | passed | +1.0818% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | passed | +2.0921% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | passed | +1.0406% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | +0.5038% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +1.0427% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | +1.4566% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | +1.1018% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | +3.4651% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | +0.3507% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +3.1171% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | +0.1959% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | -0.3994% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | +0.8147% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | -1.3931% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | +0.8305% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | incomplete | -5.4682% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | incomplete | +1.1005% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | incomplete | +1.2642% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | incomplete | +0.4014% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | +0.1189% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | -1.2767% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | -1.2976% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | +1.4165% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | +0.2110% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | -1.3132% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +0.4380% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | -0.5301% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:first:edit` | passed | +2.8010% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:first:restore` | unstable | +11.5288% | +3.2470% |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:repeat:edit` | passed | +0.0641% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:repeat:restore` | passed | +0.2979% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:first:edit` | passed | -0.9197% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:first:restore` | passed | +1.9737% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | passed | +0.3336% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:restore` | passed | +0.8305% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:first:edit` | passed | +0.1165% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:first:restore` | unstable | +5.3951% | +4.7353% |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:edit` | passed | +0.1595% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:restore` | passed | +1.3568% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:first:edit` | passed | +4.4315% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:first:restore` | passed | +3.3496% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:edit` | passed | +0.3234% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | passed | +2.9413% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:edit` | passed | -6.6926% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:restore` | unstable | +7.8183% | -4.1686% |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:edit` | passed | -0.3779% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:restore` | passed | -2.6560% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | passed | -4.4944% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:restore` | passed | +1.8456% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | passed | -1.4162% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:restore` | passed | +1.3201% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | passed | -1.3300% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:restore` | passed | +0.1759% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | passed | -2.0553% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:restore` | passed | +0.2080% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:edit` | passed | -2.4034% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:restore` | passed | +0.0977% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | passed | -2.4712% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:restore` | passed | +1.7890% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | +2.2811% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | passed | -0.8293% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | +1.3540% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | +3.2113% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +4.0009% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | +0.8255% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | +0.1456% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | +0.4555% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | passed | +0.4529% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:restore` | passed | -0.7862% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | passed | -0.0688% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | regression | +6.8883% | +6.6190% |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | incomplete | — | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | incomplete | — | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | incomplete | — | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | incomplete | — | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | +4.1785% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | passed | +1.8027% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | -1.0766% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | -3.4739% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +0.9100% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | -0.0652% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | +3.0731% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | -1.4596% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | regression | +86.7319% | +92.2798% |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | regression | +86.3083% | +79.2882% |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | regression | +95.3424% | +89.9031% |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | regression | +84.0348% | +83.3270% |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:edit` | passed | +3.2837% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:restore` | passed | +0.3970% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:edit` | passed | -0.0616% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:restore` | passed | +0.6413% | — |
| ubuntu-7 | `auto-build:1:manual:first` | passed | +4.0636% | — |
| ubuntu-7 | `auto-build:1:manual:repeat` | passed | -3.8811% | — |
| ubuntu-7 | `auto-build:1:automatic:first` | passed | +0.2705% | — |
| ubuntu-7 | `auto-build:1:automatic:repeat` | passed | +1.4463% | — |
| ubuntu-7 | `auto-build:20:manual:first` | passed | +0.3873% | — |
| ubuntu-7 | `auto-build:20:manual:repeat` | passed | +1.6179% | — |
| ubuntu-7 | `auto-build:20:automatic:first` | passed | -1.3174% | — |
| ubuntu-7 | `auto-build:20:automatic:repeat` | passed | +0.2272% | — |
| ubuntu-7 | `auto-build:50:manual:first` | passed | -0.0713% | — |
| ubuntu-7 | `auto-build:50:manual:repeat` | passed | -0.7224% | — |
| ubuntu-7 | `auto-build:50:automatic:first` | passed | -3.8721% | — |
| ubuntu-7 | `auto-build:50:automatic:repeat` | passed | -0.3411% | — |
| ubuntu-7 | `auto-build:69:manual:first` | passed | +0.0116% | — |
| ubuntu-7 | `auto-build:69:manual:repeat` | passed | +1.6731% | — |
| ubuntu-7 | `auto-build:69:automatic:first` | passed | -0.6291% | — |
| ubuntu-7 | `auto-build:69:automatic:repeat` | passed | +4.9022% | — |
| ubuntu-8 | `auto-hmr:1:manual:first:edit` | regression | +47.9861% | +50.3182% |
| ubuntu-8 | `auto-hmr:1:manual:first:restore` | passed | +4.4893% | — |
| ubuntu-8 | `auto-hmr:1:manual:repeat:edit` | passed | -0.3725% | — |
| ubuntu-8 | `auto-hmr:1:manual:repeat:restore` | passed | +2.2670% | — |
| ubuntu-8 | `auto-hmr:1:automatic:first:edit` | regression | +56.1816% | +56.6272% |
| ubuntu-8 | `auto-hmr:1:automatic:first:restore` | passed | +2.2641% | — |
| ubuntu-8 | `auto-hmr:1:automatic:repeat:edit` | passed | +0.9269% | — |
| ubuntu-8 | `auto-hmr:1:automatic:repeat:restore` | passed | -0.3843% | — |
| ubuntu-8 | `auto-hmr:20:manual:first:edit` | regression | +52.5075% | +53.6282% |
| ubuntu-8 | `auto-hmr:20:manual:first:restore` | regression | +65.7765% | +66.3905% |
| ubuntu-8 | `auto-hmr:20:manual:repeat:edit` | regression | +115.0963% | +108.0130% |
| ubuntu-8 | `auto-hmr:20:manual:repeat:restore` | regression | +12.7059% | +11.8276% |
| ubuntu-8 | `auto-hmr:20:automatic:first:edit` | regression | +52.5921% | +56.8435% |
| ubuntu-8 | `auto-hmr:20:automatic:first:restore` | passed | -1.1327% | — |
| ubuntu-8 | `auto-hmr:20:automatic:repeat:edit` | regression | +92.2981% | +63.0237% |
| ubuntu-8 | `auto-hmr:20:automatic:repeat:restore` | regression | +31.2930% | +33.1609% |
| ubuntu-8 | `auto-hmr:50:manual:first:edit` | regression | +58.8072% | +57.3960% |
| ubuntu-8 | `auto-hmr:50:manual:first:restore` | regression | +99.9267% | +103.6544% |
| ubuntu-8 | `auto-hmr:50:manual:repeat:edit` | regression | +80.7314% | +84.3584% |
| ubuntu-8 | `auto-hmr:50:manual:repeat:restore` | regression | +59.6252% | +61.0874% |
| ubuntu-8 | `auto-hmr:50:automatic:first:edit` | regression | +52.8691% | +49.9660% |
| ubuntu-8 | `auto-hmr:50:automatic:first:restore` | regression | +76.9575% | +76.1241% |
| ubuntu-8 | `auto-hmr:50:automatic:repeat:edit` | regression | +111.8532% | +115.4302% |
| ubuntu-8 | `auto-hmr:50:automatic:repeat:restore` | regression | +107.1608% | +108.8200% |
| ubuntu-8 | `auto-hmr:69:manual:first:edit` | regression | +53.2886% | +50.8512% |
| ubuntu-8 | `auto-hmr:69:manual:first:restore` | regression | +107.3374% | +107.1751% |
| ubuntu-8 | `auto-hmr:69:manual:repeat:edit` | regression | +85.8652% | +86.7390% |
| ubuntu-8 | `auto-hmr:69:manual:repeat:restore` | regression | +90.3136% | +89.2786% |
| ubuntu-8 | `auto-hmr:69:automatic:first:edit` | regression | +57.7051% | +55.7415% |
| ubuntu-8 | `auto-hmr:69:automatic:first:restore` | regression | +78.4223% | +77.7610% |
| ubuntu-8 | `auto-hmr:69:automatic:repeat:edit` | regression | +67.5371% | +66.6619% |
| ubuntu-8 | `auto-hmr:69:automatic:repeat:restore` | regression | +70.3066% | +66.7487% |
| windows-0 | `build:weapp-vite-tailwindcss-tdesign-template:first` | passed | -4.2004% | — |
| windows-0 | `build:weapp-vite-tailwindcss-tdesign-template:repeat` | unstable | +6.8068% | -11.5024% |
| windows-0 | `build:weapp-vite-template:first` | passed | +0.9837% | — |
| windows-0 | `build:weapp-vite-template:repeat` | unstable | +5.4790% | -0.6858% |
| windows-0 | `build:weapp-vite-wevu-template:first` | passed | +3.5811% | — |
| windows-0 | `build:weapp-vite-wevu-template:repeat` | passed | +1.9973% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | +2.4429% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | +2.3131% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | +4.3042% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | +3.3822% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | passed | +2.6499% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | passed | +3.6796% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | passed | +1.2399% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | passed | +3.1016% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | +1.4176% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +1.8575% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | +2.4859% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | +1.1858% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | +2.6196% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | +1.7901% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +1.8227% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | +2.1536% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | -0.9887% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | -0.7822% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | -1.9839% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | -3.3334% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | incomplete | +1.6921% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | incomplete | +4.9952% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | incomplete | -4.1359% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | incomplete | +10.0273% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | -39.0312% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +0.2420% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | -0.7752% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | -1.2923% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | -0.3150% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | +0.1974% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +0.0101% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | +0.6156% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:first:edit` | passed | -0.0567% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:first:restore` | passed | +2.3783% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:repeat:edit` | passed | +1.7642% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:repeat:restore` | passed | +1.9983% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:first:edit` | passed | +2.1774% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:first:restore` | passed | +0.8187% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | passed | -0.5413% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:restore` | passed | +4.0687% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:first:edit` | passed | -0.6069% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:first:restore` | passed | +0.1624% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:edit` | passed | +1.8480% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:restore` | passed | +2.0339% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:first:edit` | unstable | +5.4784% | +0.3371% |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:first:restore` | passed | +3.6498% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:edit` | passed | +1.2190% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | passed | +3.7572% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:edit` | passed | -2.5811% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:restore` | passed | -3.5779% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:edit` | passed | -3.3479% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:restore` | passed | -1.6876% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | incomplete | -0.3969% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:restore` | incomplete | -9.2834% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | incomplete | -6.6251% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:restore` | incomplete | -7.7216% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | passed | -3.0975% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:restore` | passed | -0.3755% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | passed | -0.8055% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:restore` | passed | -1.2533% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:edit` | passed | -1.1322% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:restore` | passed | +1.4957% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | passed | -2.4480% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:restore` | passed | -0.3100% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | -2.3077% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | passed | +3.7376% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | +0.1434% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | +4.0853% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +2.6685% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | +2.3888% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | +4.3269% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | -5.0856% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | passed | +2.5719% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:restore` | passed | +1.7214% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | passed | +1.7441% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | passed | -1.1926% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | incomplete | — | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | incomplete | — | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | incomplete | — | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | incomplete | — | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | -6.1510% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | passed | -0.8232% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | -5.9605% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | -3.0863% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +1.7482% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | +1.0220% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | -0.8205% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | +1.9257% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | regression | +83.1200% | +89.1110% |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | regression | +84.2328% | +97.5415% |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | regression | +81.1713% | +83.7346% |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | regression | +92.5853% | +85.9781% |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:edit` | passed | -3.1191% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:restore` | passed | -3.0485% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:edit` | passed | -1.4886% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:restore` | passed | +1.9913% | — |
| windows-7 | `auto-build:1:manual:first` | passed | -0.4075% | — |
| windows-7 | `auto-build:1:manual:repeat` | regression | +8.3438% | +22.9249% |
| windows-7 | `auto-build:1:automatic:first` | regression | +19.3103% | +21.3724% |
| windows-7 | `auto-build:1:automatic:repeat` | regression | +10.7531% | +16.5197% |
| windows-7 | `auto-build:20:manual:first` | passed | -9.9724% | — |
| windows-7 | `auto-build:20:manual:repeat` | passed | -10.8880% | — |
| windows-7 | `auto-build:20:automatic:first` | passed | -3.3651% | — |
| windows-7 | `auto-build:20:automatic:repeat` | passed | -3.7330% | — |
| windows-7 | `auto-build:50:manual:first` | passed | +3.3651% | — |
| windows-7 | `auto-build:50:manual:repeat` | passed | +0.5521% | — |
| windows-7 | `auto-build:50:automatic:first` | passed | -7.6723% | — |
| windows-7 | `auto-build:50:automatic:repeat` | passed | -10.6450% | — |
| windows-7 | `auto-build:69:manual:first` | passed | -9.7317% | — |
| windows-7 | `auto-build:69:manual:repeat` | passed | -2.4739% | — |
| windows-7 | `auto-build:69:automatic:first` | passed | -1.3739% | — |
| windows-7 | `auto-build:69:automatic:repeat` | passed | -2.0294% | — |

## 自动导入成本

已归档 80 条功能成本记录；0 条同时超过 25% 且 200ms，0 条不完整。剩余两片 auto-hmr 尚未纳入，不能宣称三 OS 功能成本已完整。该成本门槛与跨版本 5% 门禁分别记录。

## 原始与脱敏校验

| 分片 | 解压字节 | 原始 SHA256 | 脱敏 SHA256 | artifact |
| --- | ---: | --- | --- | --- |
| [macos-0](./nightly-pr1086-36275298244-macos-0.json.gz) | 174475 | `04bc9ae89b9594f97c0135a65fe4ce33099d165824e3516fbf2caad2cef34a2c` | `fdd8ea290ac6ae046502982be6831948c2913fe0ac65996537b53af7243b32f9` | [10919295552](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10919295552) |
| [macos-1](./nightly-pr1086-36275298244-macos-1.json.gz) | 3337961 | `5e029c56cbbf6f2b32f0905f4514e1b3bfaf7fd84dff5e125685d5492ec00bb8` | `175c13346917917d2a736d4dbab06408b2527cb2c4b445cff983daab4be49a95` | [10919198977](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10919198977) |
| [macos-2](./nightly-pr1086-36275298244-macos-2.json.gz) | 735060 | `09e51f3c685379ea13633c32f91d120c688b38b835198592ee79bfa5c670b41b` | `1d69f44fe4683f87d6860480c787159fd7957c0a0855d895145c18ee1cb97faf` | [10919554447](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10919554447) |
| [macos-3](./nightly-pr1086-36275298244-macos-3.json.gz) | 3443545 | `8b22d8c1171c45b116928b07ee791bd8e42763d52ee68159908858d7ef8ea68a` | `bb54a82f03e8e4e3a57ab16e426528cca1f0a429faec54687545ab76fb684931` | [10919009766](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10919009766) |
| [macos-4](./nightly-pr1086-36275298244-macos-4.json.gz) | 698129 | `561db5abf06bcc95ded5ac1d53b81d5d6c50ab9cfd0d338c21e8253583209aec` | `ac2cc30ccaac68f233312e85aa9561cd88595c16e5f268ecddd55b083298a3ea` | [10919901068](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10919901068) |
| [macos-5](./nightly-pr1086-36275298244-macos-5.json.gz) | 4176213 | `521db7a84177916876f30de3e657b02ef2a8a2d5b20c0d08ed00bce25e4193a3` | `ca6ba9841bb4e4086f45771f5e47f7d3af6f326be685c15406cf03858b71b025` | [10920108015](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10920108015) |
| [macos-6](./nightly-pr1086-36275298244-macos-6.json.gz) | 680811 | `b6c308a17598d3afbe3387a577a9579114beb8ad4705e5b19bc72c64f2d0134b` | `8fbbae9f8bb36ce3580bfae716e315a09bd9d7c2bcfea5f81f73fa234c40a122` | [10920237793](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10920237793) |
| [macos-7](./nightly-pr1086-36275298244-macos-7.json.gz) | 217097 | `6948d8dd811737ce3732e28a372ad86affbd125fcedd9b9978d540e9a85afcde` | `0e515434edca42369d2b791b638c596ebe24c952653b17123d375c9f64b0529a` | [10920152105](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10920152105) |
| [ubuntu-0](./nightly-pr1086-36275298244-ubuntu-0.json.gz) | 143683 | `d794776582bcf70d98e79750bd69117d1ff5058a05df1b734dd68228e3ac2efe` | `b1116f5d4adaf34e37a05b10960bd722826d6b45a82f631045fa101c1015781a` | [10917212467](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917212467) |
| [ubuntu-1](./nightly-pr1086-36275298244-ubuntu-1.json.gz) | 3149974 | `7da097aa84ab97cae3717eb888328257c727a9f00e5b0850885968b3ad155e2f` | `cb1f48f5d61718479fb8cbea6acfc95392595e2e2733907fc6fad9cd49f515bb` | [10917656475](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917656475) |
| [ubuntu-2](./nightly-pr1086-36275298244-ubuntu-2.json.gz) | 670374 | `47a46d86c2b9cf7dd730889b3d1ab88dc25bd7aee129ae054ed57f94ed8570f3` | `01ba1ad00828fb13f1022871febbcfd97552eea86dafd909ba8879fd91b0ccf2` | [10917494008](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917494008) |
| [ubuntu-3](./nightly-pr1086-36275298244-ubuntu-3.json.gz) | 3276267 | `991352e97d58899bd107375a2c23d60787dd145dd76add5284bd2a1ca667ec2b` | `7a8e15d2b7dbfafd710891fa562ed3ccd313bb7ac712963db24ad0bc8ac3d19f` | [10917613329](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917613329) |
| [ubuntu-4](./nightly-pr1086-36275298244-ubuntu-4.json.gz) | 622834 | `eebcd0e303c5cd361ffdc855441797782e61bc540ca425b8d16ef20884544efe` | `5e5e42976b97a7495c01c58f4a78d0036c3e8b43a2a959f099309b61d8c7a17c` | [10917786251](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917786251) |
| [ubuntu-5](./nightly-pr1086-36275298244-ubuntu-5.json.gz) | 3427273 | `e391ebb79994b025975838a0e4e7570d796570a64eb65782cb8286b4b852b50c` | `87c70ca4edbb3a9d68af0d759ea151e1a8097d8a21b434b72535e4d6571cbde5` | [10917831772](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917831772) |
| [ubuntu-6](./nightly-pr1086-36275298244-ubuntu-6.json.gz) | 684778 | `1c605412ca70536e959360c9614cf7ee386a455f1b874feeb64fcd52510e2914` | `d5ccc8f1d90a00e40cd527433a3e47c05a33f8f412de2bc53e7ff57151f5aa0d` | [10917619460](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917619460) |
| [ubuntu-7](./nightly-pr1086-36275298244-ubuntu-7.json.gz) | 133197 | `037c464179f7ce338d9a85af483c8e0289aec2f4a0dc2dd4a5958d01fa7b19a8` | `787e533008a2d9a12a1da4bec67f7967a0659d62a0298dae690d84b6c29a49c2` | [10916909166](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10916909166) |
| [ubuntu-8](./nightly-pr1086-36275298244-ubuntu-8.json.gz) | 653894 | `4c0ccea1398765ee3bcdd4367c5a572dbaa027ce8bde59322169f8055d89a37c` | `a48ad35e7125574e924249170a31e3675f5c02eba18a5173d3fc5dbc5cb7a1a9` | [10918264737](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10918264737) |
| [windows-0](./nightly-pr1086-36275298244-windows-0.json.gz) | 164721 | `e533d28c1b2984607a1b32843ae29eb623a11c2ddd39c930b9df2c80e73b1d7b` | `be1029a021b51eac5371f52a1dd62401e45de5eeab969f78f6e87132bfc21580` | [10918001238](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10918001238) |
| [windows-1](./nightly-pr1086-36275298244-windows-1.json.gz) | 3142989 | `5c20dadf1687188234ff79c7cb29418ff490253cb69245956ba77bd065233a8b` | `7142ca3ba0217703e570c31823e4fef519d8934cc06d26b3e37b462cc2455c32` | [10917669120](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10917669120) |
| [windows-2](./nightly-pr1086-36275298244-windows-2.json.gz) | 669184 | `dfdcfd44bc9e1d69f3f30afc242494557e080941943fb3dc0c2993435498f722` | `1c04188c55cd15dd1b7c0591decc51b588d032c6230a21a42d7830bbc55eccce` | [10918657101](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10918657101) |
| [windows-3](./nightly-pr1086-36275298244-windows-3.json.gz) | 3186843 | `64c2eeb142d43512741b7cf9cf06178b0eca12fdd69bdfd87fd90810fbd109a5` | `a88b80696f18a9ea38756d1f5492b6755a99c9384973687dac38b54c3d2a7eb5` | [10918583365](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10918583365) |
| [windows-4](./nightly-pr1086-36275298244-windows-4.json.gz) | 615804 | `af34ba95bb6258d9177a873e2b4cb1edce5e33b9b8ae3922c94c406a9c685883` | `44d7d045662be7a210948140aaa2d303fd19f93707e1d913825a6a514e0cc899` | [10918059087](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10918059087) |
| [windows-5](./nightly-pr1086-36275298244-windows-5.json.gz) | 3280068 | `ff8de8ab6f3638f20879d9c5dc8285c833861725258ab3f5a8dde23c7c821b4c` | `8b0e9e48ca57599d582c4bcbd602ad15c4fb66d213702d80b41ee47d28ead94a` | [10918174419](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10918174419) |
| [windows-6](./nightly-pr1086-36275298244-windows-6.json.gz) | 682433 | `272646fbc0a0cf9e0ab2294ec230f9005e8d08173a9214a8379407c0f12c2e73` | `030eb0c4e090005cb369b7e67b629081e1502f9a2e4af09ee85c999da8093ab5` | [10919273735](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10919273735) |
| [windows-7](./nightly-pr1086-36275298244-windows-7.json.gz) | 156698 | `35b32c0353f8f545a1ec27bfdb2a9ca638808e6d429dce433c52c7a9a3274ee2` | `d30e55229e919d18e644b135c04ea8e92478da116664741f3376495685c17972` | [10918983039](https://github.com/weapp-vite/weapp-vite/actions/runs/36275298244/artifacts/10918983039) |

后续只补齐未完成分片及官方汇总，不重复下载、取消或重跑。继续按具体回退和发布失败定位；#1086 保持草稿，#1082 保持开放。
