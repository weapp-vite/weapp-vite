# main Nightly 36172401898：首批已完成分片证据

🔴 **本报告仅归档已完成的 9/27 个分片，完整性能验收未完成且已有确认回退。** 未完成分片不补零，不将局部通过解释为三平台通过。此轮不包含 PR #1085 的优化。

- [Nightly 原始运行](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898)
- 冻结 main：`d657d7b64bf2e5fb367862377255d513dab0ec07`。
- 固定批准基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`，保持不变。
- 三 OS × 九类分片；普通/自动导入构建各 7 对，HMR 各 20 对，同 runner 交替串行。超过 5% 只有一次等量确认，确认结论冲突仍为 unstable，不追加采样。
- Ubuntu classic TDesign App JSON 重复恢复 +5.57% / +8.23%，两批各 20 对，确认 regression。
- Ubuntu classic 原生样式首次编辑 +5.04% / +4.76%，首次恢复 +6.65% / +0.19%，均 unstable，不能平均或按确认值改判通过。
- Ubuntu stateful 原生 App JSON 重复编辑 +5.68% / −0.55%，Wevu 模板重复编辑 +8.21% / −0.46%，均 unstable。
- Windows 普通构建六指标各 7 对均 passed，最大 +3.17%；Ubuntu 普通构建及自动导入构建局部通过，不能替代其他分片验收。

## 分片完整性

表中计数顺序为 passed / regression / unstable / incomplete。目录编号仅作归档标识，场景身份取自原始 report.shard。

| 归档 | 原始分片身份 | 分片状态 | 指标数 | 原始 artifact |
| --- | --- | --- | --- | --- |
| ubuntu-0 | `build` | passed | 6 / 0 / 0 / 0 | [10881273446](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10881273446) |
| ubuntu-1 | `hmr:classic:weapp-vite-tailwindcss-tdesign-template` | 🔴 regression | 15 / 1 / 0 / 0 | [10882804451](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10882804451) |
| ubuntu-2 | `hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template` | 🔴 incomplete | 12 / 0 / 0 / 4 | [10881897242](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10881897242) |
| ubuntu-3 | `hmr:classic:weapp-vite-template` | 🔴 unstable | 14 / 0 / 2 / 0 | [10882397509](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10882397509) |
| ubuntu-4 | `hmr:stateful-experimental:weapp-vite-template` | 🔴 incomplete | 11 / 0 / 1 / 4 | [10883095937](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10883095937) |
| ubuntu-5 | `hmr:classic:weapp-vite-wevu-template` | 🔴 incomplete | 12 / 0 / 0 / 4 | [10882631065](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10882631065) |
| ubuntu-6 | `hmr:stateful-experimental:weapp-vite-wevu-template` | 🔴 incomplete | 11 / 0 / 1 / 4 | [10883435562](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10883435562) |
| ubuntu-7 | `auto-build` | passed | 16 / 0 / 0 / 0 | [10882229320](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10882229320) |
| windows-0 | `build` | passed | 6 / 0 / 0 / 0 | [10883162250](https://github.com/weapp-vite/weapp-vite/actions/runs/36172401898/artifacts/10883162250) |

## 生命周期与不可比较项

- classic Wevu 的 20 次固定基线 sitemap 失败仍不可比较；错误列表包含外层采集器失败与详细场景错误，共 40 条，不能算作 40 个独立失败样本。
- stateful TDesign：首批第 20 对 baseline 脚本发布超时，仅 19 对完整脚本数据。
- stateful 原生：首批第 3/5/6/8/12 对 optimized 脚本发布超时；确认第 11/13/14 对也出现同类超时，尽管确认只统计 App JSON 重复编辑，完整前置生命周期仍执行且错误仍保留。
- stateful Wevu：首批第 4/20 对 optimized 脚本发布超时。模板的唯一确认没有消除首批脚本缺项。
- 不以产物 marker 出现/消失替代 batch-published，不补采缺失数据。临时文件混合事件的确定性复现仍需真实依赖归属修复，尚未证明全部超时与 #1081 同因。

## 逐指标结果

红色优先于单批耗时下降；绿色仅用于 passed 且耗时下降的指标。按门禁的 baseline 轮次逐项配对复算中位数并核对报告，轮次与侧组合、同轮指标 ID 无重复。缺项列出实际 baseline/current 原始样本数；不完整指标的局部统计不能作为验收结论，未配对记录仍保留在原始数据。

### ubuntu-0：`build`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `weapp-vite-tailwindcss-tdesign-template:first` | passed | 7/7 | +2.09% | — | — |
| `weapp-vite-tailwindcss-tdesign-template:repeat` | 🟢 passed | 7/7 | -1.84% | — | — |
| `weapp-vite-template:first` | passed | 7/7 | +0.89% | — | — |
| `weapp-vite-template:repeat` | 🟢 passed | 7/7 | -2.80% | — | — |
| `weapp-vite-wevu-template:first` | passed | 7/7 | +2.87% | — | — |
| `weapp-vite-wevu-template:repeat` | 🟢 passed | 7/7 | -5.11% | — | — |

### ubuntu-1：`hmr:classic:weapp-vite-tailwindcss-tdesign-template`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | passed | 20/20 | +4.67% | — | — |
| `app-json:first:restore` | passed | 20/20 | +3.62% | — | — |
| `app-json:repeat:edit` | passed | 20/20 | +0.48% | — | — |
| `app-json:repeat:restore` | 🔴 regression | 20/20 | +5.57% | 20/20 | +8.23% |
| `native-page-script:first:edit` | passed | 20/20 | +2.14% | — | — |
| `native-page-script:first:restore` | passed | 20/20 | +1.05% | — | — |
| `native-page-script:repeat:edit` | passed | 20/20 | +0.91% | — | — |
| `native-page-script:repeat:restore` | 🟢 passed | 20/20 | -0.20% | — | — |
| `native-page-template:first:edit` | passed | 20/20 | +1.85% | — | — |
| `native-page-template:first:restore` | 🟢 passed | 20/20 | -0.62% | — | — |
| `native-page-template:repeat:edit` | 🟢 passed | 20/20 | -0.76% | — | — |
| `native-page-template:repeat:restore` | passed | 20/20 | +0.87% | — | — |
| `native-page-style:first:edit` | passed | 20/20 | +0.04% | — | — |
| `native-page-style:first:restore` | passed | 20/20 | +0.26% | — | — |
| `native-page-style:repeat:edit` | passed | 20/20 | +3.18% | — | — |
| `native-page-style:repeat:restore` | 🟢 passed | 20/20 | -0.26% | — | — |

### ubuntu-2：`hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | passed | 20/20 | +1.57% | — | — |
| `app-json:first:restore` | 🟢 passed | 20/20 | -2.62% | — | — |
| `app-json:repeat:edit` | passed | 20/20 | +1.68% | — | — |
| `app-json:repeat:restore` | passed | 20/20 | +0.36% | — | — |
| `native-page-script:first:edit` | 🔴 incomplete | 19/20 | +0.67% | — | — |
| `native-page-script:first:restore` | 🔴 incomplete | 19/20 | -0.57% | — | — |
| `native-page-script:repeat:edit` | 🔴 incomplete | 19/20 | +12.45% | — | — |
| `native-page-script:repeat:restore` | 🔴 incomplete | 19/20 | -1.49% | — | — |
| `native-page-template:first:edit` | passed | 20/20 | +0.51% | — | — |
| `native-page-template:first:restore` | 🟢 passed | 20/20 | -0.98% | — | — |
| `native-page-template:repeat:edit` | 🟢 passed | 20/20 | -2.28% | — | — |
| `native-page-template:repeat:restore` | passed | 20/20 | +2.00% | — | — |
| `native-page-style:first:edit` | passed | 20/20 | +0.29% | — | — |
| `native-page-style:first:restore` | 🟢 passed | 20/20 | -1.53% | — | — |
| `native-page-style:repeat:edit` | 🟢 passed | 20/20 | -1.39% | — | — |
| `native-page-style:repeat:restore` | 🟢 passed | 20/20 | -0.25% | — | — |

### ubuntu-3：`hmr:classic:weapp-vite-template`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | passed | 20/20 | +1.36% | — | — |
| `app-json:first:restore` | passed | 20/20 | +0.85% | — | — |
| `app-json:repeat:edit` | 🟢 passed | 20/20 | -0.53% | — | — |
| `app-json:repeat:restore` | 🟢 passed | 20/20 | -3.58% | — | — |
| `native-page-script:first:edit` | passed | 20/20 | +0.41% | — | — |
| `native-page-script:first:restore` | 🟢 passed | 20/20 | -0.92% | — | — |
| `native-page-script:repeat:edit` | passed | 20/20 | +0.01% | — | — |
| `native-page-script:repeat:restore` | 🟢 passed | 20/20 | -0.31% | — | — |
| `native-page-template:first:edit` | passed | 20/20 | +2.84% | — | — |
| `native-page-template:first:restore` | passed | 20/20 | +3.27% | — | — |
| `native-page-template:repeat:edit` | 🟢 passed | 20/20 | -0.32% | — | — |
| `native-page-template:repeat:restore` | passed | 20/20 | +0.44% | — | — |
| `native-page-style:first:edit` | 🔴 unstable | 20/20 | +5.04% | 20/20 | +4.76% |
| `native-page-style:first:restore` | 🔴 unstable | 20/20 | +6.65% | 20/20 | +0.19% |
| `native-page-style:repeat:edit` | passed | 20/20 | +3.07% | — | — |
| `native-page-style:repeat:restore` | 🟢 passed | 20/20 | -0.01% | — | — |

### ubuntu-4：`hmr:stateful-experimental:weapp-vite-template`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `app-json:first:edit` | passed | 20/20 | +0.28% | — | — |
| `app-json:first:restore` | passed | 20/20 | +0.53% | — | — |
| `app-json:repeat:edit` | 🔴 unstable | 20/20 | +5.68% | 20/20 | -0.55% |
| `app-json:repeat:restore` | passed | 20/20 | +0.07% | — | — |
| `native-page-script:first:edit` | 🔴 incomplete | 20/15 | — | — | — |
| `native-page-script:first:restore` | 🔴 incomplete | 20/15 | — | — | — |
| `native-page-script:repeat:edit` | 🔴 incomplete | 20/15 | — | — | — |
| `native-page-script:repeat:restore` | 🔴 incomplete | 20/15 | — | — | — |
| `native-page-template:first:edit` | passed | 20/20 | +0.30% | — | — |
| `native-page-template:first:restore` | 🟢 passed | 20/20 | -0.04% | — | — |
| `native-page-template:repeat:edit` | passed | 20/20 | +0.30% | — | — |
| `native-page-template:repeat:restore` | 🟢 passed | 20/20 | -1.01% | — | — |
| `native-page-style:first:edit` | 🟢 passed | 20/20 | -0.08% | — | — |
| `native-page-style:first:restore` | passed | 20/20 | +1.65% | — | — |
| `native-page-style:repeat:edit` | 🟢 passed | 20/20 | -2.17% | — | — |
| `native-page-style:repeat:restore` | passed | 20/20 | +0.94% | — | — |

### ubuntu-5：`hmr:classic:weapp-vite-wevu-template`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `vue-page-script:first:edit` | passed | 20/20 | +0.11% | — | — |
| `vue-page-script:first:restore` | passed | 20/20 | +0.59% | — | — |
| `vue-page-script:repeat:edit` | 🟢 passed | 20/20 | -0.12% | — | — |
| `vue-page-script:repeat:restore` | 🟢 passed | 20/20 | -3.32% | — | — |
| `vue-page-style:first:edit` | passed | 20/20 | +0.02% | — | — |
| `vue-page-style:first:restore` | passed | 20/20 | +0.06% | — | — |
| `vue-page-style:repeat:edit` | passed | 20/20 | +1.82% | — | — |
| `vue-page-style:repeat:restore` | 🟢 passed | 20/20 | -0.73% | — | — |
| `vue-page-template:first:edit` | passed | 20/20 | +4.38% | — | — |
| `vue-page-template:first:restore` | 🟢 passed | 20/20 | -5.12% | — | — |
| `vue-page-template:repeat:edit` | 🟢 passed | 20/20 | -0.35% | — | — |
| `vue-page-template:repeat:restore` | passed | 20/20 | +2.54% | — | — |
| `json-sitemap:first:edit` | 🔴 incomplete | 0/20 | — | — | — |
| `json-sitemap:first:restore` | 🔴 incomplete | 0/20 | — | — | — |
| `json-sitemap:repeat:edit` | 🔴 incomplete | 0/20 | — | — | — |
| `json-sitemap:repeat:restore` | 🔴 incomplete | 0/20 | — | — | — |

### ubuntu-6：`hmr:stateful-experimental:weapp-vite-wevu-template`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `vue-page-script:first:edit` | 🔴 incomplete | 20/18 | — | — | — |
| `vue-page-script:first:restore` | 🔴 incomplete | 20/18 | — | — | — |
| `vue-page-script:repeat:edit` | 🔴 incomplete | 20/18 | — | — | — |
| `vue-page-script:repeat:restore` | 🔴 incomplete | 20/18 | — | — | — |
| `vue-page-style:first:edit` | passed | 20/20 | +1.15% | — | — |
| `vue-page-style:first:restore` | passed | 20/20 | +0.08% | — | — |
| `vue-page-style:repeat:edit` | passed | 20/20 | +2.42% | — | — |
| `vue-page-style:repeat:restore` | 🟢 passed | 20/20 | -0.68% | — | — |
| `vue-page-template:first:edit` | passed | 20/20 | +0.12% | — | — |
| `vue-page-template:first:restore` | passed | 20/20 | +0.08% | — | — |
| `vue-page-template:repeat:edit` | 🔴 unstable | 20/20 | +8.21% | 20/20 | -0.46% |
| `vue-page-template:repeat:restore` | 🟢 passed | 20/20 | -1.89% | — | — |
| `json-sitemap:first:edit` | 🟢 passed | 20/20 | -0.67% | — | — |
| `json-sitemap:first:restore` | 🟢 passed | 20/20 | -10.46% | — | — |
| `json-sitemap:repeat:edit` | passed | 20/20 | +3.57% | — | — |
| `json-sitemap:repeat:restore` | passed | 20/20 | +1.35% | — | — |

### ubuntu-7：`auto-build`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `1:manual:first` | 🟢 passed | 7/7 | -0.71% | — | — |
| `1:manual:repeat` | passed | 7/7 | +0.06% | — | — |
| `1:automatic:first` | 🟢 passed | 7/7 | -0.49% | — | — |
| `1:automatic:repeat` | passed | 7/7 | +0.50% | — | — |
| `20:manual:first` | passed | 7/7 | +0.27% | — | — |
| `20:manual:repeat` | 🟢 passed | 7/7 | -2.12% | — | — |
| `20:automatic:first` | 🟢 passed | 7/7 | -0.81% | — | — |
| `20:automatic:repeat` | 🟢 passed | 7/7 | -1.64% | — | — |
| `50:manual:first` | 🟢 passed | 7/7 | -0.54% | — | — |
| `50:manual:repeat` | 🟢 passed | 7/7 | -0.42% | — | — |
| `50:automatic:first` | 🟢 passed | 7/7 | -1.62% | — | — |
| `50:automatic:repeat` | 🟢 passed | 7/7 | -0.47% | — | — |
| `69:manual:first` | 🟢 passed | 7/7 | -1.20% | — | — |
| `69:manual:repeat` | 🟢 passed | 7/7 | -1.01% | — | — |
| `69:automatic:first` | 🟢 passed | 7/7 | -1.17% | — | — |
| `69:automatic:repeat` | passed | 7/7 | +0.72% | — | — |

### windows-0：`build`

| 指标 | 状态 | 首批 baseline/current 样本数 | 首批变化 | 确认 baseline/current 样本数 | 确认变化 |
| --- | --- | ---: | ---: | ---: | ---: |
| `weapp-vite-tailwindcss-tdesign-template:first` | passed | 7/7 | +0.89% | — | — |
| `weapp-vite-tailwindcss-tdesign-template:repeat` | passed | 7/7 | +1.20% | — | — |
| `weapp-vite-template:first` | passed | 7/7 | +2.36% | — | — |
| `weapp-vite-template:repeat` | passed | 7/7 | +3.17% | — | — |
| `weapp-vite-wevu-template:first` | passed | 7/7 | +1.52% | — | — |
| `weapp-vite-wevu-template:repeat` | passed | 7/7 | +1.52% | — | — |

## 原始与脱敏数据校验

gzip 保留完整顶层报告的结构、数值、样本顺序、错误和执行计划，仅把 runner/toolcache 目录替换为占位符；原始 artifact 可按上方链接取回。未修改计时或采样契约。每份 gzip 解压后与脱敏对象逐项一致。

| 归档 | 原始 report.json SHA256 | 脱敏 JSON SHA256 |
| --- | --- | --- |
| [ubuntu-0](./nightly-main-36172401898-ubuntu-0.json.gz) | `fc7c1a26645b14f0f9a22382f28a8ebb62f82ebb0d9d0a210bf9192619bf1d89` | `fc7c1a26645b14f0f9a22382f28a8ebb62f82ebb0d9d0a210bf9192619bf1d89` |
| [ubuntu-1](./nightly-main-36172401898-ubuntu-1.json.gz) | `19505bb55ee1e2e23650528a07334466987ee7be24f094026333d5368b69e28d` | `19505bb55ee1e2e23650528a07334466987ee7be24f094026333d5368b69e28d` |
| [ubuntu-2](./nightly-main-36172401898-ubuntu-2.json.gz) | `a78c8d58d93c3f922473c607cc4666694a94c601b4b849239be929ed74dc81b7` | `35d788ade5f53f18d0fadf76966ccd3f9294bc03eaa62a09e37793837050538b` |
| [ubuntu-3](./nightly-main-36172401898-ubuntu-3.json.gz) | `567efef3c049c72e97580ec5decef5dbe78c4dcf2f89b14a669e653be7320a37` | `567efef3c049c72e97580ec5decef5dbe78c4dcf2f89b14a669e653be7320a37` |
| [ubuntu-4](./nightly-main-36172401898-ubuntu-4.json.gz) | `a479f04e06e117d6cf6378b07b462bd4938cd65e03b86e6385ec7bc3be635de1` | `a08bfc0dea3fd43879fc3f8e850c3e0e8175580e6562714f4684e3b080bab4e8` |
| [ubuntu-5](./nightly-main-36172401898-ubuntu-5.json.gz) | `911b0174eb636b2a090185f69e1238b3fc3ee7f66b7c41efd8ced7eb4ef058cb` | `3d531b37bbfd4fdd7c9fa72372a59afc2e53226b533821b3ff744d9af40694da` |
| [ubuntu-6](./nightly-main-36172401898-ubuntu-6.json.gz) | `5f2050a200ca677de770967a8a55dc8d4bb3accbaa6fc1f357db88f37a790a97` | `cda8698d0016bd5360fb83abfc3937e25d8b505931652e3f88ebc2c7461ff972` |
| [ubuntu-7](./nightly-main-36172401898-ubuntu-7.json.gz) | `c106e353478d676a1ac9e2dc048d54133087a5e76a0537d347c352d65a0ad6c3` | `c106e353478d676a1ac9e2dc048d54133087a5e76a0537d347c352d65a0ad6c3` |
| [windows-0](./nightly-main-36172401898-windows-0.json.gz) | `184b7e54db47ef612f1efc6aedbce563355b7bac96230e5b2c74ae58dcf982fe` | `184b7e54db47ef612f1efc6aedbce563355b7bac96230e5b2c74ae58dcf982fe` |
