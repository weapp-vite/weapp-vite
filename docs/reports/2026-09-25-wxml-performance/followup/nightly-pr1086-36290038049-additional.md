# PR #1086 新性能运行：后续分片核验

[运行 36290038049](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049) 仍在执行。本次补充 10 片，连同[首批八片](./nightly-pr1086-36290038049-partial.md)累计 18/27 片、274 项指标，尚未通过完整性能门禁。

- 冻结目标：`42a1b6fbc36f13a0692f217bc41283c7aabb2139`；不含后续 exposed 生命周期与 native writer 修正，不能替代当前 HEAD 验收。
- driver：`d657d7b64bf2e5fb367862377255d513dab0ec07`；固定基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 契约 key：`9a93c10a76b6c0ca592f9b94dfb5c3f692b73a9bbe6a05b6f486717b88bd0552`。构建 7 对、HMR 20 对交替串行，超过 5% 仅一次等量确认；未重跑、改基线或调整门禁。
- `verifyShard` 从原始样本复核身份、SHA、manifest、交替顺序、唯一性、确认计划、产物和统计。结构验证有效不等于性能通过。
- 本地复算与原报告的状态和数值一致；12 个缺样本指标的错误文案分别为 `Missing paired sample` / `Unequal sample counts`，保留原文，不声称 gate 对象逐字一致。

## 累计结果

| OS | passed | regression | unstable | incomplete |
| --- | ---: | ---: | ---: | ---: |
| ubuntu-latest | 129 | 12 | 5 | 4 |
| windows-latest | 97 | 3 | 10 | 8 |
| macos-latest | 3 | 0 | 3 | 0 |

本次新增指标：130 / 14 / 14 / 8（passed / regression / unstable / incomplete）。

## 新增分片

| 分片 | 场景 | 全局状态 | pass/regression/unstable/incomplete | 首批/确认错误条数 |
| --- | --- | --- | --- | --- |
| [macos-0](./nightly-pr1086-36290038049-macos-0.json.gz) | `build` | unstable | 3/0/3/0 | 0/0 |
| [ubuntu-2](./nightly-pr1086-36290038049-ubuntu-2.json.gz) | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | regression | 13/2/1/0 | 0/0 |
| [ubuntu-8](./nightly-pr1086-36290038049-ubuntu-8.json.gz) | `auto-hmr` | regression | 23/9/0/0 | 0/0 |
| [windows-1](./nightly-pr1086-36290038049-windows-1.json.gz) | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | unstable | 15/0/1/0 | 0/0 |
| [windows-2](./nightly-pr1086-36290038049-windows-2.json.gz) | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | regression | 13/2/1/0 | 0/0 |
| [windows-3](./nightly-pr1086-36290038049-windows-3.json.gz) | `hmr:classic:weapp-vite-template` | regression | 15/1/0/0 | 0/0 |
| [windows-4](./nightly-pr1086-36290038049-windows-4.json.gz) | `hmr:stateful-experimental:weapp-vite-template` | incomplete | 12/0/0/4 | 2/0 |
| [windows-5](./nightly-pr1086-36290038049-windows-5.json.gz) | `hmr:classic:weapp-vite-wevu-template` | incomplete | 10/0/2/4 | 40/40 |
| [windows-6](./nightly-pr1086-36290038049-windows-6.json.gz) | `hmr:stateful-experimental:weapp-vite-wevu-template` | unstable | 14/0/2/0 | 0/0 |
| [windows-7](./nightly-pr1086-36290038049-windows-7.json.gz) | `auto-build` | unstable | 12/0/4/0 | 0/0 |

## 新增确认回退

下列首次与确认批次均超过 5%。跨整段历史基线的差异不能直接归因为本 PR 的单项改动；不以中位数相减解释内部阶段。

| 分片 | 指标 | 首批变化 | 确认变化 |
| --- | --- | ---: | ---: |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | +35.8118244% | +28.5162184% |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | +18.1806501% | +19.3088250% |
| ubuntu-8 | `auto-hmr:1:manual:repeat:restore` | +6.2524236% | +5.9448488% |
| ubuntu-8 | `auto-hmr:20:manual:repeat:edit` | +11.9134262% | +11.3711609% |
| ubuntu-8 | `auto-hmr:20:manual:repeat:restore` | +13.2442060% | +11.2203898% |
| ubuntu-8 | `auto-hmr:50:manual:first:restore` | +9.9157817% | +11.6186482% |
| ubuntu-8 | `auto-hmr:50:manual:repeat:edit` | +13.7943980% | +13.4717592% |
| ubuntu-8 | `auto-hmr:50:manual:repeat:restore` | +5.8886580% | +9.6577091% |
| ubuntu-8 | `auto-hmr:50:automatic:repeat:restore` | +15.8169220% | +12.8739618% |
| ubuntu-8 | `auto-hmr:69:manual:repeat:edit` | +14.1513348% | +13.1814364% |
| ubuntu-8 | `auto-hmr:69:manual:repeat:restore` | +18.2927767% | +20.1698505% |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | +10.3049864% | +10.7061586% |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | +7.4286056% | +9.5318387% |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:restore` | +5.7149451% | +5.1772587% |

## 生命周期错误

下面保留采集器错误摘要；错误条数包含外层及场景详情，不等于独立故障数。完整错误与每侧原始样本都在归档。前置脚本发布/恢复超时不能因后续指标完整而消除；固定基线 sitemap 缺项继续标记不完整。

- windows-4 / primary：2 条错误。
  - primary pair 16 baseline: PartialHmrCollectionError: weapp-vite-template/native-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation. Failed to restore benchmark source/output: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- windows-5 / primary：40 条错误。
- windows-5 / confirmation：40 条错误。

Windows classic Wevu 两批均为固定基线 sitemap 缺项；每批保留 20 对采集记录及其 40 条外层/场景错误。Windows stateful 原生第 16 对为 baseline 脚本发布与恢复超时，未伪造配对或重采。

## 逐指标

| 分片 | 指标 | 状态 | 首批变化 | 确认变化 |
| --- | --- | --- | ---: | ---: |
| macos-0 | `build:weapp-vite-tailwindcss-tdesign-template:first` | passed | -0.7678% | — |
| macos-0 | `build:weapp-vite-tailwindcss-tdesign-template:repeat` | passed | +3.1277% | — |
| macos-0 | `build:weapp-vite-template:first` | passed | -15.9437% | — |
| macos-0 | `build:weapp-vite-template:repeat` | unstable | +8.8703% | +3.0575% |
| macos-0 | `build:weapp-vite-wevu-template:first` | unstable | +12.4234% | -0.8745% |
| macos-0 | `build:weapp-vite-wevu-template:repeat` | unstable | +9.0801% | +3.4552% |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | +0.2830% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | +0.4704% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | -0.3540% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | -0.6289% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | passed | +2.3547% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | regression | +35.8118% | +28.5162% |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | regression | +18.1807% | +19.3088% |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | passed | -8.0445% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | -1.2399% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +1.1140% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | -0.8996% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | +1.8971% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | -0.7298% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | +0.1811% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +0.5121% | — |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | unstable | +6.4860% | +3.8749% |
| ubuntu-8 | `auto-hmr:1:manual:first:edit` | passed | -33.2580% | — |
| ubuntu-8 | `auto-hmr:1:manual:first:restore` | passed | -15.2588% | — |
| ubuntu-8 | `auto-hmr:1:manual:repeat:edit` | passed | +1.2335% | — |
| ubuntu-8 | `auto-hmr:1:manual:repeat:restore` | regression | +6.2524% | +5.9448% |
| ubuntu-8 | `auto-hmr:1:automatic:first:edit` | passed | -33.7050% | — |
| ubuntu-8 | `auto-hmr:1:automatic:first:restore` | passed | +2.1536% | — |
| ubuntu-8 | `auto-hmr:1:automatic:repeat:edit` | passed | -1.7921% | — |
| ubuntu-8 | `auto-hmr:1:automatic:repeat:restore` | passed | +4.0033% | — |
| ubuntu-8 | `auto-hmr:20:manual:first:edit` | passed | -30.4842% | — |
| ubuntu-8 | `auto-hmr:20:manual:first:restore` | passed | +1.3451% | — |
| ubuntu-8 | `auto-hmr:20:manual:repeat:edit` | regression | +11.9134% | +11.3712% |
| ubuntu-8 | `auto-hmr:20:manual:repeat:restore` | regression | +13.2442% | +11.2204% |
| ubuntu-8 | `auto-hmr:20:automatic:first:edit` | passed | -28.4857% | — |
| ubuntu-8 | `auto-hmr:20:automatic:first:restore` | passed | -1.0564% | — |
| ubuntu-8 | `auto-hmr:20:automatic:repeat:edit` | passed | -4.8933% | — |
| ubuntu-8 | `auto-hmr:20:automatic:repeat:restore` | passed | +1.7036% | — |
| ubuntu-8 | `auto-hmr:50:manual:first:edit` | passed | -24.8439% | — |
| ubuntu-8 | `auto-hmr:50:manual:first:restore` | regression | +9.9158% | +11.6186% |
| ubuntu-8 | `auto-hmr:50:manual:repeat:edit` | regression | +13.7944% | +13.4718% |
| ubuntu-8 | `auto-hmr:50:manual:repeat:restore` | regression | +5.8887% | +9.6577% |
| ubuntu-8 | `auto-hmr:50:automatic:first:edit` | passed | -25.6271% | — |
| ubuntu-8 | `auto-hmr:50:automatic:first:restore` | passed | -4.6685% | — |
| ubuntu-8 | `auto-hmr:50:automatic:repeat:edit` | passed | -1.4939% | — |
| ubuntu-8 | `auto-hmr:50:automatic:repeat:restore` | regression | +15.8169% | +12.8740% |
| ubuntu-8 | `auto-hmr:69:manual:first:edit` | passed | -25.8264% | — |
| ubuntu-8 | `auto-hmr:69:manual:first:restore` | passed | -1.0183% | — |
| ubuntu-8 | `auto-hmr:69:manual:repeat:edit` | regression | +14.1513% | +13.1814% |
| ubuntu-8 | `auto-hmr:69:manual:repeat:restore` | regression | +18.2928% | +20.1699% |
| ubuntu-8 | `auto-hmr:69:automatic:first:edit` | passed | -21.7428% | — |
| ubuntu-8 | `auto-hmr:69:automatic:first:restore` | passed | -0.3752% | — |
| ubuntu-8 | `auto-hmr:69:automatic:repeat:edit` | passed | -0.5510% | — |
| ubuntu-8 | `auto-hmr:69:automatic:repeat:restore` | passed | -2.4157% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | +3.6795% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | +4.7386% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | +2.4530% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | +0.3977% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | unstable | +6.4878% | +1.6616% |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | passed | +1.6998% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | passed | +1.1391% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | passed | +0.6675% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | +1.9736% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +1.4968% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | +2.3857% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | +2.1248% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | +1.3216% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | +3.0149% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +2.4717% | — |
| windows-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | +2.4117% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | +0.8410% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | -2.1991% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | -0.9508% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | -1.3241% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | unstable | +6.8315% | -0.1590% |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | regression | +10.3050% | +10.7062% |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | passed | -6.6278% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | regression | +7.4286% | +9.5318% |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | -7.9617% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | -3.3476% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | -1.4465% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | -3.0208% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | -0.4333% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | -1.1831% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | -2.3340% | — |
| windows-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | -0.8926% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:first:edit` | passed | -30.5345% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:first:restore` | passed | +1.6808% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:repeat:edit` | passed | +0.5734% | — |
| windows-3 | `hmr:classic:weapp-vite-template:app-json:repeat:restore` | passed | +2.0448% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:first:edit` | passed | +3.1255% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:first:restore` | passed | +2.1663% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | passed | +1.7463% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:restore` | regression | +5.7149% | +5.1773% |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:first:edit` | passed | -2.7448% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:first:restore` | passed | +1.6723% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:edit` | passed | +2.5844% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:restore` | passed | +3.1448% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:first:edit` | passed | +3.7584% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:first:restore` | passed | +3.1655% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:edit` | passed | +1.9777% | — |
| windows-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | passed | +3.3783% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:edit` | passed | -29.6642% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:restore` | passed | -3.7036% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:edit` | passed | -3.3063% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:restore` | passed | +1.1351% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | incomplete | -1.4328% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:restore` | incomplete | -2.2887% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | incomplete | -8.1606% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:restore` | incomplete | -2.1355% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | passed | +4.5916% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:restore` | passed | -5.5595% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | passed | -1.5265% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:restore` | passed | -3.3538% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:edit` | passed | -3.8219% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:restore` | passed | -3.3125% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | passed | -1.1268% | — |
| windows-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:restore` | passed | +0.2546% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | -41.3548% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | passed | +4.1644% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | +1.1483% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | +3.6017% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +2.5531% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:restore` | unstable | +7.6978% | +1.0370% |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | +3.2081% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:restore` | unstable | +7.0709% | +1.6825% |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | passed | +4.0723% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:restore` | passed | +3.1985% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | passed | +0.6143% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | passed | +3.1219% | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | incomplete | — | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | incomplete | — | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | incomplete | — | — |
| windows-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | incomplete | — | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | -68.7597% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | passed | -2.2911% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | -3.5103% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | -4.1672% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | -0.4506% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | -0.5976% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | -0.4462% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | -0.0292% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | passed | -0.9460% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | passed | +3.6722% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | passed | +3.8471% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | unstable | +7.9390% | +0.1302% |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:edit` | passed | +0.5023% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:restore` | unstable | +5.2724% | -0.0861% |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:edit` | passed | +0.8548% | — |
| windows-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:restore` | passed | +3.1450% | — |
| windows-7 | `auto-build:1:manual:first` | unstable | +19.3072% | -15.0844% |
| windows-7 | `auto-build:1:manual:repeat` | unstable | +17.7759% | -9.2261% |
| windows-7 | `auto-build:1:automatic:first` | unstable | +9.6117% | +0.3839% |
| windows-7 | `auto-build:1:automatic:repeat` | passed | -3.0477% | — |
| windows-7 | `auto-build:20:manual:first` | unstable | +7.0708% | +1.7255% |
| windows-7 | `auto-build:20:manual:repeat` | passed | +2.5446% | — |
| windows-7 | `auto-build:20:automatic:first` | passed | -9.1357% | — |
| windows-7 | `auto-build:20:automatic:repeat` | passed | -9.2138% | — |
| windows-7 | `auto-build:50:manual:first` | passed | -6.0514% | — |
| windows-7 | `auto-build:50:manual:repeat` | passed | -4.4072% | — |
| windows-7 | `auto-build:50:automatic:first` | passed | -9.8202% | — |
| windows-7 | `auto-build:50:automatic:repeat` | passed | -4.4695% | — |
| windows-7 | `auto-build:69:manual:first` | passed | -16.6970% | — |
| windows-7 | `auto-build:69:manual:repeat` | passed | -14.1803% | — |
| windows-7 | `auto-build:69:automatic:first` | passed | -7.1061% | — |
| windows-7 | `auto-build:69:automatic:repeat` | passed | +1.7091% | — |

## 自动导入启用成本

当前已归档 64 项功能成本记录，其中 0 项同时超过 25% 且 200ms，0 项不完整。该同版本 manual/automatic 成本独立于跨版本 5% 门禁，不能抵消回退。

## 原始与脱敏完整性

gzip 保留全部原始报告结构、数值、样本顺序与错误，只替换 runner/工具缓存路径前缀。已核验 gzip 解压、内容一致性与隐私扫描。

| 分片 | 解压字节 | 原始 SHA256 | 脱敏 SHA256 | artifact |
| --- | ---: | --- | --- | --- |
| [macos-0](./nightly-pr1086-36290038049-macos-0.json.gz) | 175150 | `1850cc5ebe24218fbef0e01c4994808057d2fb26877168c5ca6718d86d46cf9d` | `aee3afe8e5406107c8d13d4e2603caf7fe7fb9de49eb155e163adccd56f26a4a` | [10923494942](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10923494942) |
| [ubuntu-2](./nightly-pr1086-36290038049-ubuntu-2.json.gz) | 714053 | `13f08fb3b7acc6da092a95cd01e5ca7bc915a9685540c107edea05401fb70e79` | `415806a74839952ffee31b9f59fb2a7dcd9c2c7c8de82d6fc423a8f5dc50be3c` | [10922589018](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10922589018) |
| [ubuntu-8](./nightly-pr1086-36290038049-ubuntu-8.json.gz) | 477787 | `5632ca0e4944503e7e47540469b5a9e9769fa6c9ae069b008f945791f3f8c3bf` | `62db2a00be1f84d4a60e76e5886e5622ac56872b50b52dd102b46126f37a6d63` | [10923303262](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10923303262) |
| [windows-1](./nightly-pr1086-36290038049-windows-1.json.gz) | 3237911 | `ed20c30cb17a05b5aa84615eb145cae9a11741e17055224693c6cfce416f6518` | `cd3270aae37287e739482b9292ec9ddcf0616297d3cc8b83e8413eba89e3744a` | [10923673526](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10923673526) |
| [windows-2](./nightly-pr1086-36290038049-windows-2.json.gz) | 712894 | `84fdd5fc92d89ec9ed995b5a69205d4735c00b837a104a7cdaca38520b41b7c3` | `1d395b282e99355716a6bcf06b4e1008e2e9c3023d4981a076e525f5f618362d` | [10924720618](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10924720618) |
| [windows-3](./nightly-pr1086-36290038049-windows-3.json.gz) | 3184348 | `82274f05f2de040f63101651cccc7765041dbcc03f4c4cc1010fa5ad702171ea` | `99d495d11b2195433cfb6f3a8dcd9d9c0a7666eea48209039c57d55e57ae827e` | [10924220178](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10924220178) |
| [windows-4](./nightly-pr1086-36290038049-windows-4.json.gz) | 614317 | `d87e4417fc2386cd4c759a504bc79e409c357cbfb56770978187477c82069f5c` | `c2d55241c532ee6521c6c469bdee008451c0d1d9634d2a9ef3add50f0eeca3e6` | [10923386920](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10923386920) |
| [windows-5](./nightly-pr1086-36290038049-windows-5.json.gz) | 3523987 | `5c7b4b169de5ae952a6d877954fb65f4f9ccaf9afe13ed786f2d2e3739ab43f7` | `4dc9da1c9195da67e32b719292b6a2bc4e8a9811ebfffe9ade0aadb23482950b` | [10923159997](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10923159997) |
| [windows-6](./nightly-pr1086-36290038049-windows-6.json.gz) | 650988 | `6e1092ec0171df7dcf0d7841b45b18c71c48a4168ec7efddf41e6004a00d8ade` | `7588585f093e6f6a90e03d575071dc59ffe3e97127e473f739a177cf9d2c26a6` | [10924016457](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10924016457) |
| [windows-7](./nightly-pr1086-36290038049-windows-7.json.gz) | 164196 | `bcf7bcc4ca25f556315d16517ba4718a8e967d8ac48fd9fe1df8d8a744070143` | `6863b0787c873ae4a68fb8920d9c37ba43f44a9ee338106f6dc40cf1bd93c394` | [10923489375](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10923489375) |

后续仅收集未下载的分片与最终汇总；当前产品仍需自己的真实 runtime 和性能验证。PR #1086 保持草稿，Issue #1082 保持开放。
