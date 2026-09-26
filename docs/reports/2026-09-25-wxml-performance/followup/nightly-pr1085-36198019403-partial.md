# PR #1085 Nightly：首批 10/27 分片

🔴 **完整采集尚在运行，已出现确认回退、不稳定和不完整项，不能判为性能通过。** 本页冻结采集到的 10 个分片，不代表剩余分片结果。

- [运行 36198019403](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403)。
- 被测 HEAD：`c571a707cc5641996c21f75da26e63751e98fb95`（#1085），不含 #1086 的监听归属修复。
- 可信驱动：`d657d7b64bf2e5fb367862377255d513dab0ec07`；固定基线：`e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 契约 `paired-v2-template-shards`；构建 7 对、HMR 20 对、仅一次等量确认，不补采、不改阈值。
- 比较对象是批准基线与当前完整 HEAD，不能将所有差异直接归因为 #1085 的单项改动。

## 已完成分片

以下 10 份均通过仓库 `verifyShard` 的身份、清单、样本、顺序、确认计划、产物和统计复算；结构复核不是性能通过。指标数顺序为 passed / regression / unstable / incomplete。

| 分片 | 状态 | 指标数 | 原始 artifact |
| --- | --- | --- | --- |
| [ubuntu-0 / build](./nightly-pr1085-36198019403-ubuntu-0.json.gz) | passed | 6 / 0 / 0 / 0 | [10891581514](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10891581514) |
| [ubuntu-1 / hmr:classic:weapp-vite-tailwindcss-tdesign-template](./nightly-pr1085-36198019403-ubuntu-1.json.gz) | passed | 16 / 0 / 0 / 0 | [10891598287](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10891598287) |
| [ubuntu-2 / hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template](./nightly-pr1085-36198019403-ubuntu-2.json.gz) | passed | 16 / 0 / 0 / 0 | [10891622835](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10891622835) |
| [ubuntu-3 / hmr:classic:weapp-vite-template](./nightly-pr1085-36198019403-ubuntu-3.json.gz) | passed | 16 / 0 / 0 / 0 | [10891362126](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10891362126) |
| [ubuntu-4 / hmr:stateful-experimental:weapp-vite-template](./nightly-pr1085-36198019403-ubuntu-4.json.gz) | 🔴 unstable | 15 / 0 / 1 / 0 | [10891278586](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10891278586) |
| [ubuntu-5 / hmr:classic:weapp-vite-wevu-template](./nightly-pr1085-36198019403-ubuntu-5.json.gz) | 🔴 incomplete | 12 / 0 / 0 / 4 | [10891728559](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10891728559) |
| [ubuntu-6 / hmr:stateful-experimental:weapp-vite-wevu-template](./nightly-pr1085-36198019403-ubuntu-6.json.gz) | 🔴 incomplete | 11 / 0 / 1 / 4 | [10892321560](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10892321560) |
| [ubuntu-7 / auto-build](./nightly-pr1085-36198019403-ubuntu-7.json.gz) | passed | 16 / 0 / 0 / 0 | [10891273342](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10891273342) |
| [windows-0 / build](./nightly-pr1085-36198019403-windows-0.json.gz) | 🔴 regression | 5 / 1 / 0 / 0 | [10892176976](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10892176976) |
| [windows-3 / hmr:classic:weapp-vite-template](./nightly-pr1085-36198019403-windows-3.json.gz) | passed | 16 / 0 / 0 / 0 | [10892621870](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10892621870) |

## 逐指标结果

🔴 表示 regression / unstable / incomplete，优先于任何单批下降；🟢 仅标 passed 且首批耗时下降。

### ubuntu-0：build

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `weapp-vite-tailwindcss-tdesign-template:first` | passed | +0.09% | — |
| `weapp-vite-tailwindcss-tdesign-template:repeat` | passed | +0.35% | — |
| `weapp-vite-template:first` | passed | +0.24% | — |
| `weapp-vite-template:repeat` | 🟢 passed | -0.46% | — |
| `weapp-vite-wevu-template:first` | 🟢 passed | -2.99% | — |
| `weapp-vite-wevu-template:repeat` | 🟢 passed | -1.93% | — |

### ubuntu-1：hmr:classic:weapp-vite-tailwindcss-tdesign-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `app-json:first:edit` | 🟢 passed | -2.17% | — |
| `app-json:first:restore` | passed | +0.44% | — |
| `app-json:repeat:edit` | 🟢 passed | -3.92% | — |
| `app-json:repeat:restore` | 🟢 passed | -8.21% | — |
| `native-page-script:first:edit` | 🟢 passed | -1.81% | — |
| `native-page-script:first:restore` | 🟢 passed | -1.32% | — |
| `native-page-script:repeat:edit` | passed | +0.65% | — |
| `native-page-script:repeat:restore` | 🟢 passed | -1.41% | — |
| `native-page-template:first:edit` | passed | +0.02% | — |
| `native-page-template:first:restore` | passed | +0.02% | — |
| `native-page-template:repeat:edit` | 🟢 passed | -0.82% | — |
| `native-page-template:repeat:restore` | 🟢 passed | -1.51% | — |
| `native-page-style:first:edit` | passed | +0.09% | — |
| `native-page-style:first:restore` | 🟢 passed | -0.87% | — |
| `native-page-style:repeat:edit` | 🟢 passed | -0.34% | — |
| `native-page-style:repeat:restore` | 🟢 passed | -0.29% | — |

### ubuntu-2：hmr:stateful-experimental:weapp-vite-tailwindcss-tdesign-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `app-json:first:edit` | passed | +0.35% | — |
| `app-json:first:restore` | 🟢 passed | -0.10% | — |
| `app-json:repeat:edit` | 🟢 passed | -1.19% | — |
| `app-json:repeat:restore` | passed | +0.15% | — |
| `native-page-script:first:edit` | 🟢 passed | -13.21% | — |
| `native-page-script:first:restore` | 🟢 passed | -10.07% | — |
| `native-page-script:repeat:edit` | 🟢 passed | -2.57% | — |
| `native-page-script:repeat:restore` | 🟢 passed | -2.56% | — |
| `native-page-template:first:edit` | 🟢 passed | -0.22% | — |
| `native-page-template:first:restore` | 🟢 passed | -0.89% | — |
| `native-page-template:repeat:edit` | 🟢 passed | -0.02% | — |
| `native-page-template:repeat:restore` | 🟢 passed | -0.94% | — |
| `native-page-style:first:edit` | 🟢 passed | -0.76% | — |
| `native-page-style:first:restore` | 🟢 passed | -1.71% | — |
| `native-page-style:repeat:edit` | 🟢 passed | -0.67% | — |
| `native-page-style:repeat:restore` | passed | +1.47% | — |

### ubuntu-3：hmr:classic:weapp-vite-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `app-json:first:edit` | 🟢 passed | -1.04% | — |
| `app-json:first:restore` | 🟢 passed | -0.54% | — |
| `app-json:repeat:edit` | passed | +0.34% | — |
| `app-json:repeat:restore` | 🟢 passed | -3.05% | — |
| `native-page-script:first:edit` | passed | +2.34% | — |
| `native-page-script:first:restore` | 🟢 passed | -3.52% | — |
| `native-page-script:repeat:edit` | 🟢 passed | -0.06% | — |
| `native-page-script:repeat:restore` | 🟢 passed | -0.74% | — |
| `native-page-template:first:edit` | passed | +0.13% | — |
| `native-page-template:first:restore` | passed | +3.79% | — |
| `native-page-template:repeat:edit` | passed | +3.16% | — |
| `native-page-template:repeat:restore` | 🟢 passed | -0.33% | — |
| `native-page-style:first:edit` | 🟢 passed | -0.25% | — |
| `native-page-style:first:restore` | 🟢 passed | -0.24% | — |
| `native-page-style:repeat:edit` | passed | +0.48% | — |
| `native-page-style:repeat:restore` | 🟢 passed | -0.18% | — |

### ubuntu-4：hmr:stateful-experimental:weapp-vite-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `app-json:first:edit` | 🟢 passed | -3.39% | — |
| `app-json:first:restore` | 🟢 passed | -0.69% | — |
| `app-json:repeat:edit` | passed | +0.32% | — |
| `app-json:repeat:restore` | 🟢 passed | -2.02% | — |
| `native-page-script:first:edit` | 🟢 passed | -14.82% | — |
| `native-page-script:first:restore` | 🟢 passed | -9.92% | — |
| `native-page-script:repeat:edit` | 🟢 passed | -4.37% | — |
| `native-page-script:repeat:restore` | 🟢 passed | -8.04% | — |
| `native-page-template:first:edit` | 🟢 passed | -0.14% | — |
| `native-page-template:first:restore` | 🟢 passed | -3.01% | — |
| `native-page-template:repeat:edit` | 🟢 passed | -2.54% | — |
| `native-page-template:repeat:restore` | passed | +0.18% | — |
| `native-page-style:first:edit` | 🟢 passed | -0.11% | — |
| `native-page-style:first:restore` | 🟢 passed | -0.43% | — |
| `native-page-style:repeat:edit` | 🔴 unstable | +6.83% | +1.38% |
| `native-page-style:repeat:restore` | 🟢 passed | -1.88% | — |

### ubuntu-5：hmr:classic:weapp-vite-wevu-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `vue-page-script:first:edit` | passed | +1.17% | — |
| `vue-page-script:first:restore` | passed | +2.20% | — |
| `vue-page-script:repeat:edit` | passed | +1.95% | — |
| `vue-page-script:repeat:restore` | 🟢 passed | -0.31% | — |
| `vue-page-style:first:edit` | passed | +0.07% | — |
| `vue-page-style:first:restore` | passed | +0.52% | — |
| `vue-page-style:repeat:edit` | 🟢 passed | -0.33% | — |
| `vue-page-style:repeat:restore` | 🟢 passed | -0.08% | — |
| `vue-page-template:first:edit` | passed | +0.36% | — |
| `vue-page-template:first:restore` | passed | +0.02% | — |
| `vue-page-template:repeat:edit` | passed | +0.49% | — |
| `vue-page-template:repeat:restore` | passed | +0.61% | — |
| `json-sitemap:first:edit` | 🔴 incomplete | — | — |
| `json-sitemap:first:restore` | 🔴 incomplete | — | — |
| `json-sitemap:repeat:edit` | 🔴 incomplete | — | — |
| `json-sitemap:repeat:restore` | 🔴 incomplete | — | — |

### ubuntu-6：hmr:stateful-experimental:weapp-vite-wevu-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `vue-page-script:first:edit` | 🔴 incomplete | +1.07% | — |
| `vue-page-script:first:restore` | 🔴 incomplete | +2.16% | — |
| `vue-page-script:repeat:edit` | 🔴 incomplete | -0.49% | — |
| `vue-page-script:repeat:restore` | 🔴 incomplete | -0.45% | — |
| `vue-page-style:first:edit` | passed | +2.89% | — |
| `vue-page-style:first:restore` | 🟢 passed | -0.63% | — |
| `vue-page-style:repeat:edit` | 🔴 unstable | +11.11% | -1.08% |
| `vue-page-style:repeat:restore` | 🟢 passed | -2.64% | — |
| `vue-page-template:first:edit` | passed | +3.11% | — |
| `vue-page-template:first:restore` | passed | +3.99% | — |
| `vue-page-template:repeat:edit` | passed | +0.06% | — |
| `vue-page-template:repeat:restore` | passed | +0.40% | — |
| `json-sitemap:first:edit` | 🟢 passed | -0.05% | — |
| `json-sitemap:first:restore` | passed | +2.69% | — |
| `json-sitemap:repeat:edit` | passed | +0.24% | — |
| `json-sitemap:repeat:restore` | 🟢 passed | -0.35% | — |

### ubuntu-7：auto-build

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `1:manual:first` | 🟢 passed | -3.48% | — |
| `1:manual:repeat` | 🟢 passed | -2.94% | — |
| `1:automatic:first` | 🟢 passed | -2.48% | — |
| `1:automatic:repeat` | 🟢 passed | -1.48% | — |
| `20:manual:first` | 🟢 passed | -1.28% | — |
| `20:manual:repeat` | 🟢 passed | -1.68% | — |
| `20:automatic:first` | 🟢 passed | -2.81% | — |
| `20:automatic:repeat` | 🟢 passed | -2.67% | — |
| `50:manual:first` | 🟢 passed | -0.21% | — |
| `50:manual:repeat` | 🟢 passed | -2.07% | — |
| `50:automatic:first` | 🟢 passed | -2.09% | — |
| `50:automatic:repeat` | 🟢 passed | -1.99% | — |
| `69:manual:first` | 🟢 passed | -2.21% | — |
| `69:manual:repeat` | 🟢 passed | -2.56% | — |
| `69:automatic:first` | 🟢 passed | -2.08% | — |
| `69:automatic:repeat` | 🟢 passed | -1.75% | — |

### windows-0：build

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `weapp-vite-tailwindcss-tdesign-template:first` | passed | +0.06% | — |
| `weapp-vite-tailwindcss-tdesign-template:repeat` | 🔴 regression | +9.84% | +20.36% |
| `weapp-vite-template:first` | 🟢 passed | -2.92% | — |
| `weapp-vite-template:repeat` | 🟢 passed | -5.83% | — |
| `weapp-vite-wevu-template:first` | 🟢 passed | -6.28% | — |
| `weapp-vite-wevu-template:repeat` | 🟢 passed | -12.42% | — |

### windows-3：hmr:classic:weapp-vite-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `app-json:first:edit` | 🟢 passed | -0.80% | — |
| `app-json:first:restore` | 🟢 passed | -3.12% | — |
| `app-json:repeat:edit` | 🟢 passed | -0.67% | — |
| `app-json:repeat:restore` | 🟢 passed | -2.49% | — |
| `native-page-script:first:edit` | 🟢 passed | -1.47% | — |
| `native-page-script:first:restore` | 🟢 passed | -3.67% | — |
| `native-page-script:repeat:edit` | 🟢 passed | -1.75% | — |
| `native-page-script:repeat:restore` | 🟢 passed | -3.53% | — |
| `native-page-template:first:edit` | 🟢 passed | -1.92% | — |
| `native-page-template:first:restore` | 🟢 passed | -3.13% | — |
| `native-page-template:repeat:edit` | 🟢 passed | -2.92% | — |
| `native-page-template:repeat:restore` | 🟢 passed | -0.32% | — |
| `native-page-style:first:edit` | 🟢 passed | -1.95% | — |
| `native-page-style:first:restore` | 🟢 passed | -0.73% | — |
| `native-page-style:repeat:edit` | 🟢 passed | -1.06% | — |
| `native-page-style:repeat:restore` | 🟢 passed | -5.93% | — |

## Windows 重复构建确认回退

TDesign repeat：首批中位数 7394.30 → 8121.83 ms（+9.84%），唯一确认 7202.22 → 8668.42 ms（+20.36%），每批各 7 对。不能用其他构建下降抵消。构建正常启动并完成、产物匹配；后续先核对 Windows 启动层、路径、文件系统及逐样本 CLI/外部开销，再做产品归因。

| 批次 | 侧 | CLI 中位数 ms | 每样本 wall−CLI 中位数 ms |
| --- | --- | ---: | ---: |
| primary | baseline | 5097.00 | 2297.30 |
| primary | optimized | 5489.00 | 2617.14 |
| confirmation | baseline | 4962.00 | 2253.40 |
| confirmation | optimized | 6001.00 | 2644.18 |

上述外部开销先逐样本相减再求中位数，不能将分段中位数相减当因果证据。RSS partial 表示有探针未取到样本，不补零；墙钟及 CLI 原始计时均保留。

## 生命周期与不可比较项

- 🔴 Ubuntu stateful 原生样式 repeat edit 为 +6.83% / +1.38%，结论冲突判 unstable。
- 🔴 Ubuntu stateful Wevu 样式 repeat edit 为 +11.11% / −1.08%，仍为 unstable。
- 🔴 Ubuntu stateful Wevu 首批第 11 对 baseline、确认第 18 对 optimized 有脚本发布协议超时；脚本四指标 incomplete，不以文件标记替代发布协议。
- 🔴 Ubuntu classic Wevu 固定基线 sitemap 四指标 incomplete，保留原始缺陷，不改基线或删场景。
- Ubuntu classic 原生与 TDesign、stateful TDesign 的局部门禁通过，不代表三 OS 或 PR 整体验收完成。
- 自动导入启用成本与 5% 门禁分开，Ubuntu auto-build 的 1/20/50/69 手动/自动完整数据保留在归档，不能用跨配置平均数抵消异常。

## 数据校验

归档保留完整顶层报告及原始样本/错误，仅脱敏 runner/toolcache 路径。

| 文件 | 原始 SHA256 | 脱敏解压 SHA256 |
| --- | --- | --- |
| [ubuntu-0](./nightly-pr1085-36198019403-ubuntu-0.json.gz) | `9adb7c172a400eee2dbc550b830f75934a59185ab2b654a8cbb2a832ed04e526` | `27e3d1029f2bbe5202c0799303ad4cec9275827c26acbe06d8d40a39e3414768` |
| [ubuntu-1](./nightly-pr1085-36198019403-ubuntu-1.json.gz) | `ef09a2f9e29e988f5c9cd2fd29d59c5942910f216575dec34d3a3fa2cb7f6b11` | `c9745ad6e00aa1fa8e39e15ca289109ede2d3af024bc16f8afcb559b26386d30` |
| [ubuntu-2](./nightly-pr1085-36198019403-ubuntu-2.json.gz) | `095867085285104076e7622fd394c0b6601a6e56793095c6546e1c8146b04d3d` | `f9fc5aaa035586e6cad665c46e77893662f9d6e3034670232e013802938d9b45` |
| [ubuntu-3](./nightly-pr1085-36198019403-ubuntu-3.json.gz) | `461a1e95070ee07d0f4400d5eaefc8097c3ec496ea6c135f2c243e55056bda35` | `b0b9accce33ef8f556c5f0cc69f30a75b8d82f1f39318521fc6905a5bbd8601e` |
| [ubuntu-4](./nightly-pr1085-36198019403-ubuntu-4.json.gz) | `1d6d19d7f30ca93d7cd7b0fa6c65cff851560e7297ba3b6f14e58efeb8ba4766` | `4572c396fe2cd9f0da19c32cd17411d1251ed0f885cc58a5f3a5b721cdc4cd39` |
| [ubuntu-5](./nightly-pr1085-36198019403-ubuntu-5.json.gz) | `caa34c9abae762bc6b1d302bcd8a4364d3296d11151cb87d31ab1db341341a47` | `c7fe6204273662a5a3fd3bb17fb18d24274fb3264d485383e4ca888e81654b72` |
| [ubuntu-6](./nightly-pr1085-36198019403-ubuntu-6.json.gz) | `a2940c86ee891419abbb39f7cefc71f93d90ea00b7ff0ab9af87b0fde9c56f1a` | `16ff8f470ea46c30ab2b2b8a2553fd94247dac68474ebb7b87860fc8dab2b844` |
| [ubuntu-7](./nightly-pr1085-36198019403-ubuntu-7.json.gz) | `8f9456df9ab2977ead4650b8fe57ab4afee708140cc2c57bace4b104fa58e278` | `27e891245118ebbbb555518effa0cd7644d76adcc7e2ef45a41c17a192f5ef38` |
| [windows-0](./nightly-pr1085-36198019403-windows-0.json.gz) | `1776bdd1165ffb7f40b1e393e8b2057989af1869813334d6afed6e90dcc28e7e` | `704b01ccbb50f2ea6e5a7d3b1d0adc33b674f934a351a6b843721cd9edd83023` |
| [windows-3](./nightly-pr1085-36198019403-windows-3.json.gz) | `2a412a8cea592646c875be1a820509161652df75760e92f2db20b6eb22f32a34` | `53106d9295ce92a2ef230fe2bb82ecb31f0b3a35d99658bbb01cd98e280abd5b` |
