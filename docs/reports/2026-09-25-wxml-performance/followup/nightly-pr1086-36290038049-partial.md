# PR #1086 新性能运行：首批 8/27 分片

[运行 36290038049](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049) 仍在执行。首批八片 108 指标已下载与复算：99 passed / 1 regression / 4 unstable / 4 incomplete，不代表完整门禁。

- 冻结目标：`42a1b6fbc36f13a0692f217bc41283c7aabb2139`，含重复快照与 Tailwind 休眠修正；不含后续 exposed 生命周期及 native writer 修改。
- driver：`d657d7b64bf2e5fb367862377255d513dab0ec07`；固定基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 契约 key：`9a93c10a76b6c0ca592f9b94dfb5c3f692b73a9bbe6a05b6f486717b88bd0552`。构建7对/HMR20对、交替串行、超过5%唯一一次等量确认，未修改阈值、轮询或样本。
- verifyShard 复核身份/SHA、清单、样本和顺序、产物、确认计划、状态及统计；结构有效不等于性能通过。

## 当前结果

| 分片 | 场景 | 全局状态 | pass/regression/unstable/incomplete | 原 artifact |
| --- | --- | --- | --- | --- |
| [ubuntu-0](./nightly-pr1086-36290038049-ubuntu-0.json.gz) | `build` | passed | 6/0/0/0 | [10921679989](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10921679989) |
| [ubuntu-1](./nightly-pr1086-36290038049-ubuntu-1.json.gz) | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | passed | 16/0/0/0 | [10922427045](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10922427045) |
| [ubuntu-3](./nightly-pr1086-36290038049-ubuntu-3.json.gz) | `hmr:classic:weapp-vite-template` | passed | 16/0/0/0 | [10922810242](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10922810242) |
| [ubuntu-4](./nightly-pr1086-36290038049-ubuntu-4.json.gz) | `hmr:stateful-experimental:weapp-vite-template` | passed | 16/0/0/0 | [10922765001](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10922765001) |
| [ubuntu-5](./nightly-pr1086-36290038049-ubuntu-5.json.gz) | `hmr:classic:weapp-vite-wevu-template` | incomplete | 10/0/2/4 | [10922478711](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10922478711) |
| [ubuntu-6](./nightly-pr1086-36290038049-ubuntu-6.json.gz) | `hmr:stateful-experimental:weapp-vite-wevu-template` | regression | 13/1/2/0 | [10922861247](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10922861247) |
| [ubuntu-7](./nightly-pr1086-36290038049-ubuntu-7.json.gz) | `auto-build` | passed | 16/0/0/0 | [10923120212](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10923120212) |
| [windows-0](./nightly-pr1086-36290038049-windows-0.json.gz) | `build` | passed | 6/0/0/0 | [10922628139](https://github.com/weapp-vite/weapp-vite/actions/runs/36290038049/artifacts/10922628139) |

## 仍未通过的边界

Ubuntu stateful Wevu 模板重复编辑，首批20对中位数727.6279735→764.0139215ms（+5.0006252%），确认20对720.128859→769.4809175ms（+6.8532260%），仍判确认回退；不因接近阈值改变口径。相应其他模板指标的改善不抵消本项失败。

Ubuntu classic Wevu 基线 json-sitemap 两批持续缺项，四指标 incomplete。其余两项为 unstable；不把固定基线不可比较项改为当前版本通过，不补零或删掉生命周期错误。

## 逐指标

| 分片 | 指标 | 状态 | 首批变化 | 确认变化 |
| --- | --- | --- | ---: | ---: |
| ubuntu-0 | `build:weapp-vite-tailwindcss-tdesign-template:first` | passed | +0.1954% | — |
| ubuntu-0 | `build:weapp-vite-tailwindcss-tdesign-template:repeat` | passed | -0.3815% | — |
| ubuntu-0 | `build:weapp-vite-template:first` | passed | +0.9453% | — |
| ubuntu-0 | `build:weapp-vite-template:repeat` | passed | +0.0183% | — |
| ubuntu-0 | `build:weapp-vite-wevu-template:first` | passed | -0.9878% | — |
| ubuntu-0 | `build:weapp-vite-wevu-template:repeat` | passed | +0.4049% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | passed | +1.6316% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | passed | +0.3895% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | passed | +1.6257% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | passed | -8.2829% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | passed | +0.0588% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | passed | -0.2013% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | passed | -0.7392% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | passed | -0.0735% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | passed | +1.3682% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +1.8739% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | passed | +0.2926% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | passed | -0.2199% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | passed | +2.5666% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | passed | +3.0560% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | passed | +3.0181% | — |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | -0.3424% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:first:edit` | passed | -37.4982% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:first:restore` | passed | +0.2982% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:repeat:edit` | passed | -0.1313% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:app-json:repeat:restore` | passed | +1.1405% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:first:edit` | passed | -0.0065% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:first:restore` | passed | +2.5245% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:edit` | passed | +2.1154% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-script:repeat:restore` | passed | +3.4753% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:first:edit` | passed | +0.2051% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:first:restore` | passed | +4.5220% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:edit` | passed | +2.6511% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-template:repeat:restore` | passed | +0.1918% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:first:edit` | passed | +1.6839% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:first:restore` | passed | +0.7421% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:edit` | passed | +2.8060% | — |
| ubuntu-3 | `hmr:classic:weapp-vite-template:native-page-style:repeat:restore` | passed | +3.0847% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:edit` | passed | -31.0160% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:first:restore` | passed | +0.3841% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:edit` | passed | +0.1407% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:restore` | passed | -1.2496% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | passed | +0.9673% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:restore` | passed | +4.2119% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | passed | +0.8677% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:restore` | passed | +4.8603% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | passed | -0.1129% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:restore` | passed | +2.4386% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | passed | -0.3309% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:restore` | passed | -0.3023% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:edit` | passed | -2.2715% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:restore` | passed | -0.5158% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | passed | -0.0445% | — |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:restore` | passed | -0.2611% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | -39.2376% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | passed | +2.2366% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | -0.0591% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | +0.3305% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +0.3846% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | +2.9916% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | -0.1907% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:restore` | unstable | +5.0399% | +1.1618% |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | passed | +4.3071% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:restore` | passed | +0.9995% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | passed | -0.1514% | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | unstable | +5.4708% | +0.5713% |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | incomplete | — | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | incomplete | — | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | incomplete | — | — |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | incomplete | — | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | -64.8914% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | unstable | +6.0961% | -32.1063% |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | passed | +1.0626% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | passed | -1.5027% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +1.0708% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:restore` | passed | +0.0986% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | +2.9335% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | passed | -0.0272% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | passed | +2.8772% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | passed | -4.8216% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | regression | +5.0006% | +6.8532% |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | unstable | +7.9763% | +3.3372% |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:edit` | passed | +3.6261% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:restore` | passed | +1.4687% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:edit` | passed | +0.2510% | — |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:restore` | passed | +0.1433% | — |
| ubuntu-7 | `auto-build:1:manual:first` | passed | +0.7148% | — |
| ubuntu-7 | `auto-build:1:manual:repeat` | passed | -0.0662% | — |
| ubuntu-7 | `auto-build:1:automatic:first` | passed | +0.5963% | — |
| ubuntu-7 | `auto-build:1:automatic:repeat` | passed | +0.9273% | — |
| ubuntu-7 | `auto-build:20:manual:first` | passed | -0.1815% | — |
| ubuntu-7 | `auto-build:20:manual:repeat` | passed | +0.7053% | — |
| ubuntu-7 | `auto-build:20:automatic:first` | passed | +0.1713% | — |
| ubuntu-7 | `auto-build:20:automatic:repeat` | passed | +0.8507% | — |
| ubuntu-7 | `auto-build:50:manual:first` | passed | +1.3375% | — |
| ubuntu-7 | `auto-build:50:manual:repeat` | passed | +0.3735% | — |
| ubuntu-7 | `auto-build:50:automatic:first` | passed | +1.5701% | — |
| ubuntu-7 | `auto-build:50:automatic:repeat` | passed | +0.3972% | — |
| ubuntu-7 | `auto-build:69:manual:first` | passed | -0.0003% | — |
| ubuntu-7 | `auto-build:69:manual:repeat` | passed | +0.6112% | — |
| ubuntu-7 | `auto-build:69:automatic:first` | passed | +0.0697% | — |
| ubuntu-7 | `auto-build:69:automatic:repeat` | passed | +0.8269% | — |
| windows-0 | `build:weapp-vite-tailwindcss-tdesign-template:first` | passed | +1.1004% | — |
| windows-0 | `build:weapp-vite-tailwindcss-tdesign-template:repeat` | passed | +1.6658% | — |
| windows-0 | `build:weapp-vite-template:first` | passed | +0.8602% | — |
| windows-0 | `build:weapp-vite-template:repeat` | passed | +1.0142% | — |
| windows-0 | `build:weapp-vite-wevu-template:first` | passed | -0.1777% | — |
| windows-0 | `build:weapp-vite-wevu-template:repeat` | passed | +1.1819% | — |

## 完整性与归档

| 分片 | 解压字节 | 原始 SHA256 | 脱敏 SHA256 |
| --- | ---: | --- | --- |
| [ubuntu-0](./nightly-pr1086-36290038049-ubuntu-0.json.gz) | 143577 | `a3e21abc8b56f6ad78f8bced161f9c9cfe4f74fdab4ced4d94c76340a9b23cfc` | `f325c098a0d401866b99ac29b54bab9a0a578d65fab1c7f90070600c63f45061` |
| [ubuntu-1](./nightly-pr1086-36290038049-ubuntu-1.json.gz) | 3150371 | `afd9a3c1a58459ea8d827d7ec59828cb511e75bfb68980ac7192ab18db49abf9` | `744b7ee40e4e12b7be54727e256486863dc7991cfa5f6a01ef89a09ffb03338b` |
| [ubuntu-3](./nightly-pr1086-36290038049-ubuntu-3.json.gz) | 3095236 | `bab8131ea77c44fd5f07747f5078ad94c1752ad1f652148c5bde25a5fbfea451` | `4422cc6000856f94d8a6c19a4e7f1b799c906aabbeec8d104b71fc2008cc9c0f` |
| [ubuntu-4](./nightly-pr1086-36290038049-ubuntu-4.json.gz) | 604077 | `b302794cf8ff511dadcdc6f1e9621e16db185e8bee2175fbb88553d10177ead2` | `097d3c0a43aacc9d4378113a09612b90f4c64b1d10af896c6d6e7f3cddc71f7f` |
| [ubuntu-5](./nightly-pr1086-36290038049-ubuntu-5.json.gz) | 3529625 | `edff5f26fd9d2cbe4ea27b8b92e7df646ed47b547b429dcc4c312f2f1fc4d2c2` | `427de7d2ef2dca1fa17ecdf88a8f6ca11e4eb0bea1283392b1a76af95d339b1c` |
| [ubuntu-6](./nightly-pr1086-36290038049-ubuntu-6.json.gz) | 665900 | `b0ff27fc6e6a6515cbab11c5e18f45fb200f75acaa5c0dea4d80487ba8c62f0a` | `eefb42b84080eb2e21d38df8f464d329c624c5c0a3633576c5461ee63c292332` |
| [ubuntu-7](./nightly-pr1086-36290038049-ubuntu-7.json.gz) | 133035 | `a2173c60ef1cb1f45fadaa6eaac994fc0b6496a5ca5420fbff1046fb91ca84b0` | `c6ce5ce461a8240619c1beabe11273fc7e511b9da394394f4944b7e0d754c620` |
| [windows-0](./nightly-pr1086-36290038049-windows-0.json.gz) | 143082 | `fb8591cee311794cd1d8aed2fa10d85bc6d79e2ca9fec4baafd2e6725b751702` | `a1fe61ce278a8b8c2cbbbef2d89bfd47d426797c13ee2650487a2d2f75d6e6d6` |

尚未覆盖剩余19分片，特别是三OS auto-HMR 与 macOS 全部结果。后续仅补未收齐产物，不取消或重跑本轮。当前更新后的 PR HEAD 还需独立 CI 与性能验证，PR 保持草稿。
