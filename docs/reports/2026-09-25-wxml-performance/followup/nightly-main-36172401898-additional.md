# main Nightly 36172401898：后续 18 个分片证据

🔴 **本次补充 18 个已完成分片，连同[首批 9 个](./nightly-main-36172401898-partial.md)共归档 27/27 个分片；本轮已全部结束，完整性能未通过。** 本轮冻结旧 main，不包含 #1085 和 #1086 的修复。

- 冻结 main / 驱动：`d657d7b64bf2e5fb367862377255d513dab0ec07`。
- 固定批准基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`，采样契约 `paired-v2-template-shards`。
- [原始运行](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898)：三 OS、构建 7 对、HMR 20 对；超过 5% 仅一次等量确认。未修改样本、轮询或判定阈值。
- 新确认回退：Ubuntu `auto-hmr:20:manual:repeat:edit` +16.48% / +10.21%；Windows `auto-hmr:1:manual:first:restore` +9.07% / +5.56%；macOS `auto-build:50:manual:first` +8.24% / +6.14%。
- macOS 另外确认：stateful TDesign App JSON 首次编辑 +16.02% / +6.66%；classic Wevu 脚本重复恢复 +10.44% / +9.09%。
- 前三项均是手动配置，不能仅凭指标分类含 auto 就归因为组件自动发现成本；编译、文件监听和发布链路仍须分别定位。
- Windows 原生 classic/stateful 全部 16 项局部 passed，自动导入构建 16 项局部 passed；不能抵消其他场景失败。macOS 原生 classic 的 4 个越线指标均为 unstable，不按确认下降改判通过。

## 身份与完整性复核

使用仓库 `verifyShard` 从原始样本复核 schema、用途、两侧 SHA、驱动 SHA、OS、清单、确认计划、交替顺序、重复轮次、构建产物证据及门禁状态；所有 18 份通过结构复核。结构复核成功不等于性能通过。完整指标的首批/确认中位数、百分比、P95 与逐样本复算一致。缺项保留原始单侧记录，不伪造配对或补零。

指标数顺序为 passed / regression / unstable / incomplete；分片名称取自原始报告。

| 归档 | 分片 | 状态 | 指标数 | 原始 artifact |
| --- | --- | --- | --- | --- |
| [macos-0](./nightly-main-36172401898-macos-0.json.gz) | `build` | 🔴 unstable | 4 / 0 / 2 / 0 | [10885262339](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10885262339) |
| [macos-1](./nightly-main-36172401898-macos-1.json.gz) | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | 🔴 unstable | 11 / 0 / 5 / 0 | [10886843151](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10886843151) |
| [macos-2](./nightly-main-36172401898-macos-2.json.gz) | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | 🔴 regression | 9 / 1 / 2 / 4 | [10888018486](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10888018486) |
| [macos-3](./nightly-main-36172401898-macos-3.json.gz) | `hmr:classic:weapp-vite-template` | 🔴 unstable | 12 / 0 / 4 / 0 | [10887178761](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10887178761) |
| [macos-4](./nightly-main-36172401898-macos-4.json.gz) | `hmr:stateful-experimental:weapp-vite-template` | 🔴 incomplete | 15 / 0 / 0 / 1 | [10886602768](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10886602768) |
| [macos-5](./nightly-main-36172401898-macos-5.json.gz) | `hmr:classic:weapp-vite-wevu-template` | 🔴 regression | 9 / 1 / 2 / 4 | [10888491660](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10888491660) |
| [macos-6](./nightly-main-36172401898-macos-6.json.gz) | `hmr:stateful-experimental:weapp-vite-wevu-template` | 🔴 incomplete | 14 / 0 / 2 / 0 | [10888507477](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10888507477) |
| [macos-7](./nightly-main-36172401898-macos-7.json.gz) | `auto-build` | 🔴 regression | 14 / 1 / 1 / 0 | [10887004933](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10887004933) |
| [macos-8](./nightly-main-36172401898-macos-8.json.gz) | `auto-hmr` | 🔴 unstable | 23 / 0 / 9 / 0 | [10890230081](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10890230081) |
| [ubuntu-8](./nightly-main-36172401898-ubuntu-8.json.gz) | `auto-hmr` | 🔴 regression | 29 / 1 / 2 / 0 | [10883983772](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10883983772) |
| [windows-1](./nightly-main-36172401898-windows-1.json.gz) | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | 🔴 unstable | 13 / 0 / 3 / 0 | [10884448737](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10884448737) |
| [windows-2](./nightly-main-36172401898-windows-2.json.gz) | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | 🔴 incomplete | 11 / 0 / 1 / 4 | [10885262215](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10885262215) |
| [windows-3](./nightly-main-36172401898-windows-3.json.gz) | `hmr:classic:weapp-vite-template` | passed | 16 / 0 / 0 / 0 | [10884372424](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10884372424) |
| [windows-4](./nightly-main-36172401898-windows-4.json.gz) | `hmr:stateful-experimental:weapp-vite-template` | passed | 16 / 0 / 0 / 0 | [10884936527](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10884936527) |
| [windows-5](./nightly-main-36172401898-windows-5.json.gz) | `hmr:classic:weapp-vite-wevu-template` | 🔴 incomplete | 12 / 0 / 0 / 4 | [10884179839](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10884179839) |
| [windows-6](./nightly-main-36172401898-windows-6.json.gz) | `hmr:stateful-experimental:weapp-vite-wevu-template` | 🔴 incomplete | 14 / 0 / 1 / 1 | [10886655843](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10886655843) |
| [windows-7](./nightly-main-36172401898-windows-7.json.gz) | `auto-build` | passed | 16 / 0 / 0 / 0 | [10885932610](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10885932610) |
| [windows-8](./nightly-main-36172401898-windows-8.json.gz) | `auto-hmr` | 🔴 regression | 29 / 1 / 2 / 0 | [10887487192](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10887487192) |

## 逐指标结果

🔴 优先于单批耗时下降；🟢 仅用于 passed 且耗时下降。确认缺失或不完整均明确保留。百分比直接取原始门禁，未用平均值抵消异常。

### macos-0：`build`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `weapp-vite-tailwindcss-tdesign-template:first` | 🟢 passed | 7/7 | -1.83% | 0/0 | — |
| `weapp-vite-tailwindcss-tdesign-template:repeat` | 🔴 unstable | 7/7 | +6.03% | 7/7 | +1.21% |
| `weapp-vite-template:first` | passed | 7/7 | +4.73% | 0/0 | — |
| `weapp-vite-template:repeat` | 🟢 passed | 7/7 | -0.46% | 0/0 | — |
| `weapp-vite-wevu-template:first` | 🟢 passed | 7/7 | -6.32% | 0/0 | — |
| `weapp-vite-wevu-template:repeat` | 🔴 unstable | 7/7 | +6.73% | 7/7 | -18.56% |

### macos-1：`hmr:classic:weapp-vite-tailwindcss-tdesign-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | 🔴 unstable | 20/20 | +5.38% | 20/20 | -7.37% |
| `app-json:first:restore` | 🟢 passed | 20/20 | -3.87% | 0/0 | — |
| `app-json:repeat:edit` | passed | 20/20 | +0.84% | 0/0 | — |
| `app-json:repeat:restore` | 🔴 unstable | 20/20 | +7.47% | 20/20 | -3.31% |
| `native-page-script:first:edit` | passed | 20/20 | +1.43% | 0/0 | — |
| `native-page-script:first:restore` | 🟢 passed | 20/20 | -2.06% | 0/0 | — |
| `native-page-script:repeat:edit` | 🔴 unstable | 20/20 | +10.14% | 20/20 | -11.89% |
| `native-page-script:repeat:restore` | 🟢 passed | 20/20 | -0.94% | 0/0 | — |
| `native-page-template:first:edit` | passed | 20/20 | +2.25% | 0/0 | — |
| `native-page-template:first:restore` | 🔴 unstable | 20/20 | +15.91% | 20/20 | -1.38% |
| `native-page-template:repeat:edit` | 🟢 passed | 20/20 | -8.40% | 0/0 | — |
| `native-page-template:repeat:restore` | 🟢 passed | 20/20 | -12.27% | 0/0 | — |
| `native-page-style:first:edit` | 🔴 unstable | 20/20 | +10.06% | 20/20 | -5.57% |
| `native-page-style:first:restore` | 🟢 passed | 20/20 | -5.88% | 0/0 | — |
| `native-page-style:repeat:edit` | passed | 20/20 | +1.37% | 0/0 | — |
| `native-page-style:repeat:restore` | passed | 20/20 | +4.21% | 0/0 | — |

### macos-2：`hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | 🔴 regression | 20/20 | +16.02% | 20/20 | +6.66% |
| `app-json:first:restore` | 🔴 unstable | 20/20 | +10.76% | 20/20 | -3.56% |
| `app-json:repeat:edit` | 🔴 unstable | 20/20 | +7.76% | 20/20 | +0.81% |
| `app-json:repeat:restore` | passed | 20/20 | +3.00% | 0/0 | — |
| `native-page-script:first:edit` | 🔴 incomplete | 19/20 | +5.16% | 0/0 | — |
| `native-page-script:first:restore` | 🔴 incomplete | 19/20 | -10.73% | 0/0 | — |
| `native-page-script:repeat:edit` | 🔴 incomplete | 19/20 | +4.90% | 0/0 | — |
| `native-page-script:repeat:restore` | 🔴 incomplete | 19/20 | -14.83% | 0/0 | — |
| `native-page-template:first:edit` | 🟢 passed | 20/20 | -4.11% | 0/0 | — |
| `native-page-template:first:restore` | passed | 20/20 | +0.13% | 0/0 | — |
| `native-page-template:repeat:edit` | 🟢 passed | 20/20 | -8.54% | 0/0 | — |
| `native-page-template:repeat:restore` | 🟢 passed | 20/20 | -10.10% | 0/0 | — |
| `native-page-style:first:edit` | 🟢 passed | 20/20 | -4.44% | 0/0 | — |
| `native-page-style:first:restore` | 🟢 passed | 20/20 | -8.27% | 0/0 | — |
| `native-page-style:repeat:edit` | 🟢 passed | 20/20 | -5.09% | 0/0 | — |
| `native-page-style:repeat:restore` | passed | 20/20 | +4.06% | 0/0 | — |

### macos-3：`hmr:classic:weapp-vite-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | 🟢 passed | 20/20 | -0.23% | 0/0 | — |
| `app-json:first:restore` | passed | 20/20 | +2.22% | 0/0 | — |
| `app-json:repeat:edit` | 🟢 passed | 20/20 | -7.55% | 0/0 | — |
| `app-json:repeat:restore` | 🟢 passed | 20/20 | -3.01% | 0/0 | — |
| `native-page-script:first:edit` | passed | 20/20 | +1.23% | 0/0 | — |
| `native-page-script:first:restore` | 🟢 passed | 20/20 | -1.84% | 0/0 | — |
| `native-page-script:repeat:edit` | passed | 20/20 | +3.05% | 0/0 | — |
| `native-page-script:repeat:restore` | 🔴 unstable | 20/20 | +6.56% | 20/20 | -3.29% |
| `native-page-template:first:edit` | passed | 20/20 | +3.87% | 0/0 | — |
| `native-page-template:first:restore` | 🔴 unstable | 20/20 | +26.20% | 20/20 | -3.23% |
| `native-page-template:repeat:edit` | passed | 20/20 | +4.06% | 0/0 | — |
| `native-page-template:repeat:restore` | 🟢 passed | 20/20 | -7.05% | 0/0 | — |
| `native-page-style:first:edit` | 🔴 unstable | 20/20 | +5.83% | 20/20 | -13.09% |
| `native-page-style:first:restore` | 🟢 passed | 20/20 | -7.54% | 0/0 | — |
| `native-page-style:repeat:edit` | 🔴 unstable | 20/20 | +6.23% | 20/20 | +1.79% |
| `native-page-style:repeat:restore` | 🟢 passed | 20/20 | -5.31% | 0/0 | — |

### macos-4：`hmr:stateful-experimental:weapp-vite-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | 🟢 passed | 20/20 | -9.77% | 0/0 | — |
| `app-json:first:restore` | 🟢 passed | 20/20 | -5.59% | 0/0 | — |
| `app-json:repeat:edit` | passed | 20/20 | +0.13% | 0/0 | — |
| `app-json:repeat:restore` | passed | 20/20 | +0.09% | 0/0 | — |
| `native-page-script:first:edit` | 🟢 passed | 20/20 | -17.61% | 0/0 | — |
| `native-page-script:first:restore` | 🟢 passed | 20/20 | -12.69% | 0/0 | — |
| `native-page-script:repeat:edit` | 🔴 incomplete | 20/20 | +11.22% | 1/0 | — |
| `native-page-script:repeat:restore` | 🟢 passed | 20/20 | -2.80% | 0/0 | — |
| `native-page-template:first:edit` | passed | 20/20 | +1.88% | 0/0 | — |
| `native-page-template:first:restore` | passed | 20/20 | +3.00% | 0/0 | — |
| `native-page-template:repeat:edit` | 🟢 passed | 20/20 | -1.59% | 0/0 | — |
| `native-page-template:repeat:restore` | passed | 20/20 | +1.43% | 0/0 | — |
| `native-page-style:first:edit` | 🟢 passed | 20/20 | -13.39% | 0/0 | — |
| `native-page-style:first:restore` | passed | 20/20 | +3.97% | 0/0 | — |
| `native-page-style:repeat:edit` | 🟢 passed | 20/20 | -5.74% | 0/0 | — |
| `native-page-style:repeat:restore` | passed | 20/20 | +2.56% | 0/0 | — |

### macos-5：`hmr:classic:weapp-vite-wevu-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `vue-page-script:first:edit` | passed | 20/20 | +0.00% | 0/0 | — |
| `vue-page-script:first:restore` | passed | 20/20 | +1.18% | 0/0 | — |
| `vue-page-script:repeat:edit` | 🔴 unstable | 20/20 | +7.24% | 20/20 | -4.76% |
| `vue-page-script:repeat:restore` | 🔴 regression | 20/20 | +10.44% | 20/20 | +9.09% |
| `vue-page-style:first:edit` | 🟢 passed | 20/20 | -7.70% | 0/0 | — |
| `vue-page-style:first:restore` | passed | 20/20 | +0.85% | 0/0 | — |
| `vue-page-style:repeat:edit` | 🟢 passed | 20/20 | -0.98% | 0/0 | — |
| `vue-page-style:repeat:restore` | passed | 20/20 | +4.08% | 0/0 | — |
| `vue-page-template:first:edit` | 🟢 passed | 20/20 | -4.50% | 0/0 | — |
| `vue-page-template:first:restore` | 🔴 unstable | 20/20 | +7.13% | 20/20 | +0.07% |
| `vue-page-template:repeat:edit` | passed | 20/20 | +1.18% | 0/0 | — |
| `vue-page-template:repeat:restore` | 🟢 passed | 20/20 | -3.27% | 0/0 | — |
| `json-sitemap:first:edit` | 🔴 incomplete | 0/20 | — | 0/0 | — |
| `json-sitemap:first:restore` | 🔴 incomplete | 0/20 | — | 0/0 | — |
| `json-sitemap:repeat:edit` | 🔴 incomplete | 0/20 | — | 0/0 | — |
| `json-sitemap:repeat:restore` | 🔴 incomplete | 0/20 | — | 0/0 | — |

### macos-6：`hmr:stateful-experimental:weapp-vite-wevu-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `vue-page-script:first:edit` | 🟢 passed | 20/20 | -9.36% | 0/0 | — |
| `vue-page-script:first:restore` | passed | 20/20 | +4.91% | 0/0 | — |
| `vue-page-script:repeat:edit` | passed | 20/20 | +2.34% | 0/0 | — |
| `vue-page-script:repeat:restore` | passed | 20/20 | +4.10% | 0/0 | — |
| `vue-page-style:first:edit` | passed | 20/20 | +4.80% | 0/0 | — |
| `vue-page-style:first:restore` | 🟢 passed | 20/20 | -1.01% | 0/0 | — |
| `vue-page-style:repeat:edit` | 🟢 passed | 20/20 | -1.82% | 0/0 | — |
| `vue-page-style:repeat:restore` | 🟢 passed | 20/20 | -1.72% | 0/0 | — |
| `vue-page-template:first:edit` | 🔴 unstable | 20/20 | +6.25% | 20/20 | +4.01% |
| `vue-page-template:first:restore` | 🔴 unstable | 20/20 | +8.37% | 20/20 | +2.80% |
| `vue-page-template:repeat:edit` | 🟢 passed | 20/20 | -2.58% | 0/0 | — |
| `vue-page-template:repeat:restore` | 🟢 passed | 20/20 | -6.07% | 0/0 | — |
| `json-sitemap:first:edit` | 🟢 passed | 20/20 | -2.13% | 0/0 | — |
| `json-sitemap:first:restore` | 🟢 passed | 20/20 | -1.29% | 0/0 | — |
| `json-sitemap:repeat:edit` | passed | 20/20 | +2.80% | 0/0 | — |
| `json-sitemap:repeat:restore` | 🟢 passed | 20/20 | -0.11% | 0/0 | — |

### macos-7：`auto-build`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `1:manual:first` | passed | 7/7 | +4.40% | 0/0 | — |
| `1:manual:repeat` | 🟢 passed | 7/7 | -4.07% | 0/0 | — |
| `1:automatic:first` | 🟢 passed | 7/7 | -14.87% | 0/0 | — |
| `1:automatic:repeat` | 🟢 passed | 7/7 | -20.50% | 0/0 | — |
| `20:manual:first` | 🟢 passed | 7/7 | -9.42% | 0/0 | — |
| `20:manual:repeat` | passed | 7/7 | +1.41% | 0/0 | — |
| `20:automatic:first` | 🟢 passed | 7/7 | -3.23% | 0/0 | — |
| `20:automatic:repeat` | passed | 7/7 | +2.04% | 0/0 | — |
| `50:manual:first` | 🔴 regression | 7/7 | +8.24% | 7/7 | +6.14% |
| `50:manual:repeat` | 🔴 unstable | 7/7 | +21.68% | 7/7 | -5.08% |
| `50:automatic:first` | passed | 7/7 | +2.67% | 0/0 | — |
| `50:automatic:repeat` | 🟢 passed | 7/7 | -3.47% | 0/0 | — |
| `69:manual:first` | 🟢 passed | 7/7 | -3.19% | 0/0 | — |
| `69:manual:repeat` | 🟢 passed | 7/7 | -10.69% | 0/0 | — |
| `69:automatic:first` | 🟢 passed | 7/7 | -8.00% | 0/0 | — |
| `69:automatic:repeat` | passed | 7/7 | +1.49% | 0/0 | — |

### macos-8：`auto-hmr`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `1:manual:first:edit` | 🟢 passed | 20/20 | -4.20% | 0/0 | — |
| `1:manual:first:restore` | passed | 20/20 | +1.41% | 0/0 | — |
| `1:manual:repeat:edit` | passed | 20/20 | +2.17% | 0/0 | — |
| `1:manual:repeat:restore` | 🟢 passed | 20/20 | -14.06% | 0/0 | — |
| `1:automatic:first:edit` | 🔴 unstable | 20/20 | +9.94% | 20/20 | -3.72% |
| `1:automatic:first:restore` | passed | 20/20 | +2.81% | 0/0 | — |
| `1:automatic:repeat:edit` | 🔴 unstable | 20/20 | +12.64% | 20/20 | -2.20% |
| `1:automatic:repeat:restore` | 🔴 unstable | 20/20 | +7.13% | 20/20 | -1.73% |
| `20:manual:first:edit` | 🟢 passed | 20/20 | -1.52% | 0/0 | — |
| `20:manual:first:restore` | 🟢 passed | 20/20 | -4.78% | 0/0 | — |
| `20:manual:repeat:edit` | 🟢 passed | 20/20 | -7.23% | 0/0 | — |
| `20:manual:repeat:restore` | 🟢 passed | 20/20 | -4.86% | 0/0 | — |
| `20:automatic:first:edit` | 🟢 passed | 20/20 | -0.39% | 0/0 | — |
| `20:automatic:first:restore` | 🟢 passed | 20/20 | -9.11% | 0/0 | — |
| `20:automatic:repeat:edit` | 🟢 passed | 20/20 | -4.92% | 0/0 | — |
| `20:automatic:repeat:restore` | 🔴 unstable | 20/20 | +8.14% | 20/20 | -4.42% |
| `50:manual:first:edit` | 🔴 unstable | 20/20 | +5.96% | 20/20 | -1.59% |
| `50:manual:first:restore` | 🔴 unstable | 20/20 | +6.76% | 20/20 | -3.95% |
| `50:manual:repeat:edit` | 🟢 passed | 20/20 | -9.85% | 0/0 | — |
| `50:manual:repeat:restore` | passed | 20/20 | +2.74% | 0/0 | — |
| `50:automatic:first:edit` | 🟢 passed | 20/20 | -6.26% | 0/0 | — |
| `50:automatic:first:restore` | 🟢 passed | 20/20 | -2.38% | 0/0 | — |
| `50:automatic:repeat:edit` | passed | 20/20 | +0.61% | 0/0 | — |
| `50:automatic:repeat:restore` | 🟢 passed | 20/20 | -2.12% | 0/0 | — |
| `69:manual:first:edit` | passed | 20/20 | +1.90% | 0/0 | — |
| `69:manual:first:restore` | 🔴 unstable | 20/20 | +15.82% | 20/20 | -7.93% |
| `69:manual:repeat:edit` | passed | 20/20 | +0.21% | 0/0 | — |
| `69:manual:repeat:restore` | 🔴 unstable | 20/20 | +6.20% | 20/20 | -6.72% |
| `69:automatic:first:edit` | 🟢 passed | 20/20 | -1.11% | 0/0 | — |
| `69:automatic:first:restore` | 🔴 unstable | 20/20 | +5.88% | 20/20 | -3.45% |
| `69:automatic:repeat:edit` | passed | 20/20 | +3.03% | 0/0 | — |
| `69:automatic:repeat:restore` | 🟢 passed | 20/20 | -6.13% | 0/0 | — |

### ubuntu-8：`auto-hmr`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `1:manual:first:edit` | 🔴 unstable | 20/20 | +5.14% | 20/20 | +0.69% |
| `1:manual:first:restore` | 🟢 passed | 20/20 | -0.24% | 0/0 | — |
| `1:manual:repeat:edit` | passed | 20/20 | +1.24% | 0/0 | — |
| `1:manual:repeat:restore` | 🟢 passed | 20/20 | -1.88% | 0/0 | — |
| `1:automatic:first:edit` | passed | 20/20 | +1.65% | 0/0 | — |
| `1:automatic:first:restore` | passed | 20/20 | +0.14% | 0/0 | — |
| `1:automatic:repeat:edit` | 🟢 passed | 20/20 | -0.03% | 0/0 | — |
| `1:automatic:repeat:restore` | passed | 20/20 | +0.88% | 0/0 | — |
| `20:manual:first:edit` | 🟢 passed | 20/20 | -0.29% | 0/0 | — |
| `20:manual:first:restore` | 🟢 passed | 20/20 | -0.88% | 0/0 | — |
| `20:manual:repeat:edit` | 🔴 regression | 20/20 | +16.48% | 20/20 | +10.21% |
| `20:manual:repeat:restore` | 🟢 passed | 20/20 | -0.38% | 0/0 | — |
| `20:automatic:first:edit` | passed | 20/20 | +0.57% | 0/0 | — |
| `20:automatic:first:restore` | 🟢 passed | 20/20 | -0.21% | 0/0 | — |
| `20:automatic:repeat:edit` | passed | 20/20 | +0.43% | 0/0 | — |
| `20:automatic:repeat:restore` | 🔴 unstable | 20/20 | +5.30% | 20/20 | +1.87% |
| `50:manual:first:edit` | passed | 20/20 | +1.23% | 0/0 | — |
| `50:manual:first:restore` | passed | 20/20 | +1.52% | 0/0 | — |
| `50:manual:repeat:edit` | passed | 20/20 | +3.48% | 0/0 | — |
| `50:manual:repeat:restore` | 🟢 passed | 20/20 | -2.03% | 0/0 | — |
| `50:automatic:first:edit` | passed | 20/20 | +2.32% | 0/0 | — |
| `50:automatic:first:restore` | 🟢 passed | 20/20 | -0.51% | 0/0 | — |
| `50:automatic:repeat:edit` | passed | 20/20 | +0.96% | 0/0 | — |
| `50:automatic:repeat:restore` | 🟢 passed | 20/20 | -2.09% | 0/0 | — |
| `69:manual:first:edit` | passed | 20/20 | +0.39% | 0/0 | — |
| `69:manual:first:restore` | passed | 20/20 | +1.12% | 0/0 | — |
| `69:manual:repeat:edit` | passed | 20/20 | +0.23% | 0/0 | — |
| `69:manual:repeat:restore` | passed | 20/20 | +1.63% | 0/0 | — |
| `69:automatic:first:edit` | passed | 20/20 | +0.62% | 0/0 | — |
| `69:automatic:first:restore` | 🟢 passed | 20/20 | -1.54% | 0/0 | — |
| `69:automatic:repeat:edit` | 🟢 passed | 20/20 | -0.52% | 0/0 | — |
| `69:automatic:repeat:restore` | passed | 20/20 | +0.02% | 0/0 | — |

### windows-1：`hmr:classic:weapp-vite-tailwindcss-tdesign-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | passed | 20/20 | +1.26% | 0/0 | — |
| `app-json:first:restore` | 🟢 passed | 20/20 | -1.17% | 0/0 | — |
| `app-json:repeat:edit` | passed | 20/20 | +0.09% | 0/0 | — |
| `app-json:repeat:restore` | passed | 20/20 | +0.60% | 0/0 | — |
| `native-page-script:first:edit` | passed | 20/20 | +4.62% | 0/0 | — |
| `native-page-script:first:restore` | 🟢 passed | 20/20 | -1.87% | 0/0 | — |
| `native-page-script:repeat:edit` | passed | 20/20 | +0.89% | 0/0 | — |
| `native-page-script:repeat:restore` | 🟢 passed | 20/20 | -3.07% | 0/0 | — |
| `native-page-template:first:edit` | passed | 20/20 | +0.93% | 0/0 | — |
| `native-page-template:first:restore` | 🔴 unstable | 20/20 | +5.39% | 20/20 | +1.15% |
| `native-page-template:repeat:edit` | passed | 20/20 | +4.98% | 0/0 | — |
| `native-page-template:repeat:restore` | passed | 20/20 | +2.20% | 0/0 | — |
| `native-page-style:first:edit` | passed | 20/20 | +2.58% | 0/0 | — |
| `native-page-style:first:restore` | 🔴 unstable | 20/20 | +8.18% | 20/20 | -0.80% |
| `native-page-style:repeat:edit` | 🔴 unstable | 20/20 | +9.58% | 20/20 | +3.85% |
| `native-page-style:repeat:restore` | passed | 20/20 | +0.73% | 0/0 | — |

### windows-2：`hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | passed | 20/20 | +4.24% | 0/0 | — |
| `app-json:first:restore` | 🟢 passed | 20/20 | -2.34% | 0/0 | — |
| `app-json:repeat:edit` | 🟢 passed | 20/20 | -3.56% | 0/0 | — |
| `app-json:repeat:restore` | 🟢 passed | 20/20 | -4.05% | 0/0 | — |
| `native-page-script:first:edit` | 🔴 incomplete | 20/18 | — | 0/0 | — |
| `native-page-script:first:restore` | 🔴 incomplete | 20/18 | — | 0/0 | — |
| `native-page-script:repeat:edit` | 🔴 incomplete | 20/18 | — | 0/0 | — |
| `native-page-script:repeat:restore` | 🔴 incomplete | 20/18 | — | 0/0 | — |
| `native-page-template:first:edit` | 🟢 passed | 20/20 | -1.05% | 0/0 | — |
| `native-page-template:first:restore` | passed | 20/20 | +1.14% | 0/0 | — |
| `native-page-template:repeat:edit` | 🔴 unstable | 20/20 | +6.74% | 20/20 | +0.06% |
| `native-page-template:repeat:restore` | 🟢 passed | 20/20 | -0.07% | 0/0 | — |
| `native-page-style:first:edit` | passed | 20/20 | +1.70% | 0/0 | — |
| `native-page-style:first:restore` | passed | 20/20 | +1.43% | 0/0 | — |
| `native-page-style:repeat:edit` | passed | 20/20 | +1.63% | 0/0 | — |
| `native-page-style:repeat:restore` | passed | 20/20 | +0.92% | 0/0 | — |

### windows-3：`hmr:classic:weapp-vite-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | passed | 20/20 | +2.20% | — | — |
| `app-json:first:restore` | passed | 20/20 | +3.05% | — | — |
| `app-json:repeat:edit` | passed | 20/20 | +0.36% | — | — |
| `app-json:repeat:restore` | passed | 20/20 | +1.86% | — | — |
| `native-page-script:first:edit` | 🟢 passed | 20/20 | -1.49% | — | — |
| `native-page-script:first:restore` | 🟢 passed | 20/20 | -0.23% | — | — |
| `native-page-script:repeat:edit` | passed | 20/20 | +2.16% | — | — |
| `native-page-script:repeat:restore` | passed | 20/20 | +1.36% | — | — |
| `native-page-template:first:edit` | passed | 20/20 | +4.43% | — | — |
| `native-page-template:first:restore` | passed | 20/20 | +1.31% | — | — |
| `native-page-template:repeat:edit` | passed | 20/20 | +2.50% | — | — |
| `native-page-template:repeat:restore` | passed | 20/20 | +0.47% | — | — |
| `native-page-style:first:edit` | 🟢 passed | 20/20 | -0.25% | — | — |
| `native-page-style:first:restore` | passed | 20/20 | +0.39% | — | — |
| `native-page-style:repeat:edit` | passed | 20/20 | +1.89% | — | — |
| `native-page-style:repeat:restore` | passed | 20/20 | +3.32% | — | — |

### windows-4：`hmr:stateful-experimental:weapp-vite-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | 🟢 passed | 20/20 | -0.06% | — | — |
| `app-json:first:restore` | passed | 20/20 | +0.83% | — | — |
| `app-json:repeat:edit` | passed | 20/20 | +1.61% | — | — |
| `app-json:repeat:restore` | passed | 20/20 | +0.63% | — | — |
| `native-page-script:first:edit` | 🟢 passed | 20/20 | -0.13% | — | — |
| `native-page-script:first:restore` | 🟢 passed | 20/20 | -0.72% | — | — |
| `native-page-script:repeat:edit` | 🟢 passed | 20/20 | -0.12% | — | — |
| `native-page-script:repeat:restore` | 🟢 passed | 20/20 | -2.04% | — | — |
| `native-page-template:first:edit` | passed | 20/20 | +0.52% | — | — |
| `native-page-template:first:restore` | passed | 20/20 | +0.66% | — | — |
| `native-page-template:repeat:edit` | passed | 20/20 | +0.60% | — | — |
| `native-page-template:repeat:restore` | 🟢 passed | 20/20 | -0.89% | — | — |
| `native-page-style:first:edit` | 🟢 passed | 20/20 | -0.12% | — | — |
| `native-page-style:first:restore` | passed | 20/20 | +0.40% | — | — |
| `native-page-style:repeat:edit` | 🟢 passed | 20/20 | -0.20% | — | — |
| `native-page-style:repeat:restore` | 🟢 passed | 20/20 | -0.85% | — | — |

### windows-5：`hmr:classic:weapp-vite-wevu-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `vue-page-script:first:edit` | passed | 20/20 | +0.50% | — | — |
| `vue-page-script:first:restore` | passed | 20/20 | +1.52% | — | — |
| `vue-page-script:repeat:edit` | passed | 20/20 | +4.39% | — | — |
| `vue-page-script:repeat:restore` | passed | 20/20 | +1.54% | — | — |
| `vue-page-style:first:edit` | passed | 20/20 | +2.95% | — | — |
| `vue-page-style:first:restore` | passed | 20/20 | +3.13% | — | — |
| `vue-page-style:repeat:edit` | 🟢 passed | 20/20 | -0.22% | — | — |
| `vue-page-style:repeat:restore` | passed | 20/20 | +2.79% | — | — |
| `vue-page-template:first:edit` | passed | 20/20 | +1.95% | — | — |
| `vue-page-template:first:restore` | 🟢 passed | 20/20 | -0.86% | — | — |
| `vue-page-template:repeat:edit` | 🟢 passed | 20/20 | -0.83% | — | — |
| `vue-page-template:repeat:restore` | passed | 20/20 | +2.94% | — | — |
| `json-sitemap:first:edit` | 🔴 incomplete | 0/20 | — | — | — |
| `json-sitemap:first:restore` | 🔴 incomplete | 0/20 | — | — | — |
| `json-sitemap:repeat:edit` | 🔴 incomplete | 0/20 | — | — | — |
| `json-sitemap:repeat:restore` | 🔴 incomplete | 0/20 | — | — | — |

### windows-6：`hmr:stateful-experimental:weapp-vite-wevu-template`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `vue-page-script:first:edit` | 🟢 passed | 20/20 | -4.90% | 0/0 | — |
| `vue-page-script:first:restore` | 🟢 passed | 20/20 | -40.88% | 0/0 | — |
| `vue-page-script:repeat:edit` | passed | 20/20 | +4.82% | 0/0 | — |
| `vue-page-script:repeat:restore` | 🔴 incomplete | 20/20 | +8.67% | 19/20 | — |
| `vue-page-style:first:edit` | passed | 20/20 | +2.19% | 0/0 | — |
| `vue-page-style:first:restore` | 🔴 unstable | 20/20 | +11.03% | 20/20 | -1.08% |
| `vue-page-style:repeat:edit` | passed | 20/20 | +0.20% | 0/0 | — |
| `vue-page-style:repeat:restore` | passed | 20/20 | +2.46% | 0/0 | — |
| `vue-page-template:first:edit` | passed | 20/20 | +3.82% | 0/0 | — |
| `vue-page-template:first:restore` | passed | 20/20 | +2.48% | 0/0 | — |
| `vue-page-template:repeat:edit` | passed | 20/20 | +4.47% | 0/0 | — |
| `vue-page-template:repeat:restore` | 🟢 passed | 20/20 | -1.43% | 0/0 | — |
| `json-sitemap:first:edit` | passed | 20/20 | +2.29% | 0/0 | — |
| `json-sitemap:first:restore` | passed | 20/20 | +1.64% | 0/0 | — |
| `json-sitemap:repeat:edit` | passed | 20/20 | +0.58% | 0/0 | — |
| `json-sitemap:repeat:restore` | passed | 20/20 | +2.09% | 0/0 | — |

### windows-7：`auto-build`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `1:manual:first` | 🟢 passed | 7/7 | -0.86% | — | — |
| `1:manual:repeat` | passed | 7/7 | +0.50% | — | — |
| `1:automatic:first` | 🟢 passed | 7/7 | -0.41% | — | — |
| `1:automatic:repeat` | 🟢 passed | 7/7 | -0.28% | — | — |
| `20:manual:first` | passed | 7/7 | +1.47% | — | — |
| `20:manual:repeat` | 🟢 passed | 7/7 | -0.14% | — | — |
| `20:automatic:first` | 🟢 passed | 7/7 | -0.31% | — | — |
| `20:automatic:repeat` | 🟢 passed | 7/7 | -0.08% | — | — |
| `50:manual:first` | 🟢 passed | 7/7 | -0.50% | — | — |
| `50:manual:repeat` | 🟢 passed | 7/7 | -1.63% | — | — |
| `50:automatic:first` | passed | 7/7 | +0.42% | — | — |
| `50:automatic:repeat` | passed | 7/7 | +1.10% | — | — |
| `69:manual:first` | 🟢 passed | 7/7 | -0.05% | — | — |
| `69:manual:repeat` | passed | 7/7 | +0.09% | — | — |
| `69:automatic:first` | passed | 7/7 | +0.92% | — | — |
| `69:automatic:repeat` | 🟢 passed | 7/7 | -0.71% | — | — |

### windows-8：`auto-hmr`

| 指标 | 状态 | 首批 baseline/current | 首批变化 | 确认 baseline/current | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `1:manual:first:edit` | passed | 20/20 | +3.06% | 0/0 | — |
| `1:manual:first:restore` | 🔴 regression | 20/20 | +9.07% | 20/20 | +5.56% |
| `1:manual:repeat:edit` | 🟢 passed | 20/20 | -0.31% | 0/0 | — |
| `1:manual:repeat:restore` | passed | 20/20 | +4.29% | 0/0 | — |
| `1:automatic:first:edit` | passed | 20/20 | +2.84% | 0/0 | — |
| `1:automatic:first:restore` | passed | 20/20 | +2.39% | 0/0 | — |
| `1:automatic:repeat:edit` | 🟢 passed | 20/20 | -1.17% | 0/0 | — |
| `1:automatic:repeat:restore` | 🟢 passed | 20/20 | -0.64% | 0/0 | — |
| `20:manual:first:edit` | 🟢 passed | 20/20 | -0.03% | 0/0 | — |
| `20:manual:first:restore` | 🟢 passed | 20/20 | -0.89% | 0/0 | — |
| `20:manual:repeat:edit` | 🟢 passed | 20/20 | -0.02% | 0/0 | — |
| `20:manual:repeat:restore` | passed | 20/20 | +3.19% | 0/0 | — |
| `20:automatic:first:edit` | 🔴 unstable | 20/20 | +6.38% | 20/20 | +3.31% |
| `20:automatic:first:restore` | passed | 20/20 | +2.24% | 0/0 | — |
| `20:automatic:repeat:edit` | passed | 20/20 | +0.61% | 0/0 | — |
| `20:automatic:repeat:restore` | passed | 20/20 | +0.54% | 0/0 | — |
| `50:manual:first:edit` | passed | 20/20 | +1.67% | 0/0 | — |
| `50:manual:first:restore` | passed | 20/20 | +2.81% | 0/0 | — |
| `50:manual:repeat:edit` | 🔴 unstable | 20/20 | +8.22% | 20/20 | -1.58% |
| `50:manual:repeat:restore` | 🟢 passed | 20/20 | -1.77% | 0/0 | — |
| `50:automatic:first:edit` | passed | 20/20 | +1.56% | 0/0 | — |
| `50:automatic:first:restore` | passed | 20/20 | +0.57% | 0/0 | — |
| `50:automatic:repeat:edit` | 🟢 passed | 20/20 | -1.96% | 0/0 | — |
| `50:automatic:repeat:restore` | 🟢 passed | 20/20 | -1.99% | 0/0 | — |
| `69:manual:first:edit` | 🟢 passed | 20/20 | -5.17% | 0/0 | — |
| `69:manual:first:restore` | 🟢 passed | 20/20 | -0.63% | 0/0 | — |
| `69:manual:repeat:edit` | 🟢 passed | 20/20 | -0.22% | 0/0 | — |
| `69:manual:repeat:restore` | 🟢 passed | 20/20 | -3.16% | 0/0 | — |
| `69:automatic:first:edit` | passed | 20/20 | +1.88% | 0/0 | — |
| `69:automatic:first:restore` | 🟢 passed | 20/20 | -4.08% | 0/0 | — |
| `69:automatic:repeat:edit` | 🟢 passed | 20/20 | -1.63% | 0/0 | — |
| `69:automatic:repeat:restore` | passed | 20/20 | +1.84% | 0/0 | — |

## 生命周期与基线缺陷

错误条数可能同时包括外层采集器失败和内层场景详情，不等于独立失败次数。以下仅列场景详情，完整错误仍在归档内。

- 🔴 macos-2：primary pair 1 baseline: PartialHmrCollectionError: weapp-vite-tailwindcss-tdesign-template/native-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- 🔴 macos-2：confirmation pair 8 baseline: PartialHmrCollectionError: weapp-vite-tailwindcss-tdesign-template/native-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- 🔴 macos-4：confirmation pair 1 optimized: PartialHmrCollectionError: weapp-vite-template/native-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation. Failed to restore benchmark source/output: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- 🔴 macos-6：confirmation pair 7 optimized: PartialHmrCollectionError: weapp-vite-wevu-template/vue-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- 🔴 windows-2：primary pair 8 optimized: PartialHmrCollectionError: weapp-vite-tailwindcss-tdesign-template/native-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation. Failed to restore benchmark source/output: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- 🔴 windows-2：primary pair 12 optimized: PartialHmrCollectionError: weapp-vite-tailwindcss-tdesign-template/native-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- 🔴 windows-6：confirmation pair 14 baseline: PartialHmrCollectionError: weapp-vite-wevu-template/vue-page-script: Timed out waiting for a stateful HMR patch batch matching the current source mutation.
- 🔴 Windows classic Wevu 固定基线 sitemap 首批 20 次失败，保留 40 条外层及场景错误；macOS classic Wevu 首批和确认各 20 次失败、各 40 条错误。当前侧修复不使旧基线变为可比较。
- 不以输出 marker 或文件变更替代 `batch-published`。尚未证明以上所有发布超时与 #1086 或 #1081 同因。
- 固定基线不变，独立包旧 watcher 与统一发布生命周期不可比较仍单列，未被本次结果消除。

## 自动导入启用成本

同提交 manual/automatic 的额外耗时预算须同时超过 25% 和 200 ms；与跨提交 5% 门禁分开。下表为每个新增自动导入分片中所有启用成本的最大值，两列最大值可能来自不同配置，不能组合推导越线。完整配置成本保留在 JSON。

| 分片 | 配置成本项数 | 缺样本项 | 同时越预算项 | 最大额外耗时 | 最大增幅 |
| --- | ---: | ---: | ---: | ---: | ---: |
| macos-7 | 16 | 0 | 0 | 271.00 ms | +20.12% |
| macos-8 | 32 | 0 | 0 | 119.57 ms | +21.26% |
| ubuntu-8 | 32 | 0 | 0 | 203.55 ms | +26.55% |
| windows-7 | 16 | 0 | 0 | 152.61 ms | +3.64% |
| windows-8 | 32 | 0 | 0 | 208.45 ms | +16.19% |

## 原始与脱敏数据校验

gzip 保留顶层报告全部结构、数值、样本顺序和错误，仅替换 runner 与工具缓存绝对路径前缀。解压后与脱敏对象完全一致；原始 artifact 包含每轮日志、checkpoint 和报告，可按上表取回。

| 归档 | 原始 report.json SHA256 | 脱敏 JSON SHA256 |
| --- | --- | --- |
| [macos-0](./nightly-main-36172401898-macos-0.json.gz) | `b9f6b97c7af275981deb05a69656013b19e8b74d8a93baa76f1cd8fb5a7610b9` | `8480725b4cd33af5397b17800195049996aa0a4c39ab48093b73c0a74619ddf2` |
| [macos-1](./nightly-main-36172401898-macos-1.json.gz) | `1f0a29a486504b5a9ab6836caa820f7e2ad86a7e35bf7f34f89f95a15604e2e5` | `eacdabb1ceee3bee3b5048480ff3cf5cc8ad778a6921477c04efc18fef3e3f63` |
| [macos-2](./nightly-main-36172401898-macos-2.json.gz) | `eb91fc7c181277567fc943b33d4224a6a55dc3d38a4da45d7a78b5199539d674` | `894d180bc74fe7d6c5a6dfcb5b8377a127176bca9848bf25ac12bc36967ebc9b` |
| [macos-3](./nightly-main-36172401898-macos-3.json.gz) | `e3b46556cb88af2eac39c3216d911e7e6ef5e446402738d3dd7598fb39a9668c` | `680b1f683d0579a47c180f94a1f631a8e6c9976809623b5d6ea9c602cb5117ae` |
| [macos-4](./nightly-main-36172401898-macos-4.json.gz) | `c7a5d9a85baddb0555d1aa9b01414d5dcd2baba8136ecf9e754d0be98b61fac3` | `7b7ba6be219fa568b61bfa765c02d9fd63ed084b10bf7a0c639f731c27e80131` |
| [macos-5](./nightly-main-36172401898-macos-5.json.gz) | `b8a52fc410acedfbf8b8a3edc1c857cf3809c7bd5c03f9b62f0e89db99c8260a` | `bf180023f185da3dd00e3d167878d24a72bdb7704fd2563c79dd4719d8b7c6cf` |
| [macos-6](./nightly-main-36172401898-macos-6.json.gz) | `545ae2f9e0238501cd909596095bea5f9f8c58a6baa3e34e531b44dd2b438dd0` | `7c78f8ba51bd5518ef834e43bf4c57c3618a62a2b78c09660575b81d15ef81ad` |
| [macos-7](./nightly-main-36172401898-macos-7.json.gz) | `5de43a436b244e1aa3207ce34b8901f90bc93112226de806cd0a024bea24127e` | `05c374fc571b624d42709662561db35d2c9b67499fdb5cddeb7b5b74efee0fff` |
| [macos-8](./nightly-main-36172401898-macos-8.json.gz) | `8c728270930a2d7044b0438d4c9e3506388be795e8d1c33dacc3a4e54ceba080` | `d04282b1aa857bfbdb966aafe7d76cc2a00787c55c38a21d7976110f9782c157` |
| [ubuntu-8](./nightly-main-36172401898-ubuntu-8.json.gz) | `edb85cb6ba77c386d1378238841357f103df06fad9556a89d99c61bd38697616` | `11b0c5f1f66f677010c71175c24493d63faca0333afd3469e34d623c0915d0e1` |
| [windows-1](./nightly-main-36172401898-windows-1.json.gz) | `8caa4ebcd3db8ff3dc48804c739eacd2e0e468b9e177ea2f0d5a94b55d491d5f` | `f6937954d3e0767dc5b2e4a59ab6286a0796979834143be9ce38e0fe2446a45d` |
| [windows-2](./nightly-main-36172401898-windows-2.json.gz) | `cdd9d688fe9155de5d15b830dea9f156c62e91641c7f337a8b9bba1affef647b` | `8393445cc61b836c45185c2d8d329413140c99a589aff8a42cb6711f39835f32` |
| [windows-3](./nightly-main-36172401898-windows-3.json.gz) | `757f5ad38a006ae729cf3bc22362ad5ec9b59a665424e27a69345b9919c0438e` | `a31fff35c11f011185ad267f8d233f1df6932a64040249b4ee6c96a74323697c` |
| [windows-4](./nightly-main-36172401898-windows-4.json.gz) | `231962f1ecf8a3380f9c4e46e31cac38be3e633a1c38544f78a9255974ece345` | `a39a9f2e20c3760ec30b2eaf42c2ced507c4b54ea1ff0dfc80ac1a681e6fddcd` |
| [windows-5](./nightly-main-36172401898-windows-5.json.gz) | `5fbeb2ee41b98eaea7e1ab3437c59a03f8833ae56ac66768b5283923d07d66df` | `f28d91cdea1174c8f207572ddafa6241962476ebcc6e2eeaf1ebcd9d4f67a9cb` |
| [windows-6](./nightly-main-36172401898-windows-6.json.gz) | `e314f710de28066fcbdfec749b977c118ab0032abffed11f0151a092175685a2` | `faf8d3ee751be924acd52f0cbed8bdd522d8bdd805115a099e4a6b48da7076b3` |
| [windows-7](./nightly-main-36172401898-windows-7.json.gz) | `359ff74d16e5f41a72acec677efc6c358a2fa33d32925cdfb2929a7306cbed54` | `df2f62907fabe6c00494abbb6baabee4c03d38024b4bcdcb583af9c89457cdc4` |
| [windows-8](./nightly-main-36172401898-windows-8.json.gz) | `5bc2dc3739069b993b7b43573231909cde254dd994fadbea62d2219a64f1fb59` | `ba6f42003d66edb0d6f381a55b3d95d528572a68d5f248c661e5c10c7cdf5351` |
