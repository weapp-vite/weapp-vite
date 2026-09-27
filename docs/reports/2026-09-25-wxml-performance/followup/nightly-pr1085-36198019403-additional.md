# PR #1085 Nightly：新增 7 分片（累计 17/27）

🔴 完整采集仍在运行。新增 macOS 构建和 Ubuntu 自动导入 HMR 确认回退；未将不稳定、固定基线缺陷或生命周期失败改为通过。

[首批 10 分片](./nightly-pr1085-36198019403-partial.md) 保持原样。本页新增 7 份报告、118 个指标，累计 258 个指标；均经仓库 `verifyShard` 核验身份、清单、样本、顺序、确认计划、产物和统计复算。结构有效不代表性能通过。

- [运行 36198019403](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403)。
- 被测 HEAD `c571a707cc5641996c21f75da26e63751e98fb95`；driver `d657d7b64bf2e5fb367862377255d513dab0ec07`；固定基线 `e7862e61dd83e3b9e356ac1e176267b31ab298af`。
- 保留三 OS、构建 7 对、HMR 20 对和唯一等量确认；不补采、不改计时口径。#1086 不在此次被测 HEAD 中。

## 新增结果

| 分片 | 状态 | passed / regression / unstable / incomplete | 原始 artifact |
| --- | --- | --- | --- |
| [macos-0 / build](./nightly-pr1085-36198019403-macos-0.json.gz) | regression | 5 / 1 / 0 / 0 | [10893238761](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10893238761) |
| [ubuntu-8 / auto-hmr](./nightly-pr1085-36198019403-ubuntu-8.json.gz) | regression | 27 / 1 / 4 / 0 | [10892597321](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10892597321) |
| [windows-1 / hmr:classic:weapp-vite-tailwindcss-tdesign-template](./nightly-pr1085-36198019403-windows-1.json.gz) | passed | 16 / 0 / 0 / 0 | [10893425361](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10893425361) |
| [windows-4 / hmr:stateful-experimental:weapp-vite-template](./nightly-pr1085-36198019403-windows-4.json.gz) | incomplete | 15 / 0 / 1 / 0 | [10893551130](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10893551130) |
| [windows-5 / hmr:classic:weapp-vite-wevu-template](./nightly-pr1085-36198019403-windows-5.json.gz) | incomplete | 12 / 0 / 0 / 4 | [10893615371](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10893615371) |
| [windows-6 / hmr:stateful-experimental:weapp-vite-wevu-template](./nightly-pr1085-36198019403-windows-6.json.gz) | passed | 16 / 0 / 0 / 0 | [10893373850](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10893373850) |
| [windows-7 / auto-build](./nightly-pr1085-36198019403-windows-7.json.gz) | unstable | 14 / 0 / 2 / 0 | [10893004228](https://github.com/weapp-vite/weapp-vite/actions/runs/36198019403/artifacts/10893004228) |

## 新确认回退与生命周期限制

- macOS TDesign 重复构建：首批 7 对 4864.9791 → 5304.0028ms（+9.0242%），确认 7 对 4556.5097 → 4951.0471ms（+8.6588%）。Windows 同指标此前已确认回退；Ubuntu 此指标通过。现象不再只在一个 OS 出现，仍须区分启动器、路径/文件系统和编译开销。
- Ubuntu 50 组件 automatic HMR 重复恢复：首批 20 对 639.0227 → 728.5423ms（+14.0088%），确认 20 对 643.8886 → 744.9855ms（+15.7010%）。其余 4 项超过阈值的首批未在确认重现，按契约标 unstable，不写成通过。
- Windows stateful 原生模板首次恢复首批 +7.0445%、确认 -3.4058%，该指标为 unstable。更重要的是确认第 16 对 optimized 的前置脚本发布及恢复超时；即使目标模板指标采样齐全，分片整体仍为 incomplete。
- Windows classic Wevu 的 4 个 sitemap 缺项属于保留的固定基线缺陷，单列不可比较。Windows 69 组件 automatic 构建 first/repeat 均为 unstable，不能凭确认批下降判通过。
- 这些是批准基线到完整被测 HEAD 的比较，尚未证明为 #1085 单项改动所致。门禁百分比为两侧中位数比值；逐对差值的中位数是另一统计量，下表保留两者，不能将中位数相减当成分段耗时或根因。

## 回退逐样本时间线

轮次为原始零基 round + 1；执行顺序按冻结采样器交替规则列出。墙钟耗时未剔除慢样本。

### macos：build:weapp-vite-tailwindcss-tdesign-template:repeat

| 批次 | 轮次 | 顺序 | baseline ms | current ms | 成对差值 ms | baseline CLI ms | current CLI ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| primary | 1 | baseline → current | 7484.2152 | 5365.1149 | -2119.1003 | 5116 | 3561 |
| primary | 2 | current → baseline | 5216.0080 | 5248.1434 | +32.1354 | 3122 | 3252 |
| primary | 3 | baseline → current | 4392.5326 | 4747.6245 | +355.0919 | 2834 | 2960 |
| primary | 4 | current → baseline | 4864.9791 | 5329.2582 | +464.2791 | 3295 | 3458 |
| primary | 5 | baseline → current | 7998.5746 | 5304.0027 | -2694.5719 | 5372 | 3692 |
| primary | 6 | current → baseline | 4389.1006 | 6052.1908 | +1663.0902 | 3009 | 4089 |
| primary | 7 | baseline → current | 4417.0267 | 4309.2216 | -107.8050 | 3009 | 2898 |

primary 成对差值中位数：32.1354ms；门禁变化：+9.0242%。

| confirmation | 1 | baseline → current | 4742.3242 | 5559.1924 | +816.8681 | 3197 | 3496 |
| confirmation | 2 | current → baseline | 5622.9642 | 5631.2326 | +8.2684 | 3356 | 3714 |
| confirmation | 3 | baseline → current | 4911.8273 | 4951.0471 | +39.2198 | 3313 | 3126 |
| confirmation | 4 | current → baseline | 4065.7673 | 5276.0190 | +1210.2517 | 2648 | 3321 |
| confirmation | 5 | baseline → current | 4392.8738 | 4518.4670 | +125.5932 | 3061 | 3071 |
| confirmation | 6 | current → baseline | 4556.5097 | 3884.8392 | -671.6705 | 3105 | 2536 |
| confirmation | 7 | baseline → current | 4515.4105 | 3832.7361 | -682.6744 | 3094 | 2586 |

confirmation 成对差值中位数：39.2198ms；门禁变化：+8.6588%。


### ubuntu：auto-hmr:50:automatic:repeat:restore

| 批次 | 轮次 | 顺序 | baseline ms | current ms | 成对差值 ms | baseline CLI ms | current CLI ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| primary | 1 | baseline → current | 624.7403 | 718.9516 | +94.2113 | — | — |
| primary | 2 | current → baseline | 617.6626 | 719.6460 | +101.9833 | — | — |
| primary | 3 | baseline → current | 626.3594 | 723.6663 | +97.3070 | — | — |
| primary | 4 | current → baseline | 608.6036 | 643.8979 | +35.2942 | — | — |
| primary | 5 | baseline → current | 621.6156 | 730.6176 | +109.0020 | — | — |
| primary | 6 | current → baseline | 645.2720 | 606.6657 | -38.6063 | — | — |
| primary | 7 | baseline → current | 627.7491 | 614.2998 | -13.4493 | — | — |
| primary | 8 | current → baseline | 732.6963 | 635.6479 | -97.0484 | — | — |
| primary | 9 | baseline → current | 768.6263 | 754.5466 | -14.0797 | — | — |
| primary | 10 | current → baseline | 770.4564 | 771.4994 | +1.0430 | — | — |
| primary | 11 | baseline → current | 746.9856 | 801.8419 | +54.8563 | — | — |
| primary | 12 | current → baseline | 633.2756 | 755.1553 | +121.8797 | — | — |
| primary | 13 | baseline → current | 637.1202 | 636.4932 | -0.6271 | — | — |
| primary | 14 | current → baseline | 774.8284 | 618.7884 | -156.0401 | — | — |
| primary | 15 | baseline → current | 615.6367 | 734.5099 | +118.8731 | — | — |
| primary | 16 | current → baseline | 640.9251 | 726.4671 | +85.5420 | — | — |
| primary | 17 | baseline → current | 745.8755 | 736.1498 | -9.7257 | — | — |
| primary | 18 | current → baseline | 1207.6908 | 743.4071 | -464.2836 | — | — |
| primary | 19 | baseline → current | 620.1725 | 759.8525 | +139.6800 | — | — |
| primary | 20 | current → baseline | 746.6056 | 741.3733 | -5.2323 | — | — |

primary 成对差值中位数：18.1686ms；门禁变化：+14.0088%。

| confirmation | 1 | baseline → current | 643.0782 | 745.2421 | +102.1638 | — | — |
| confirmation | 2 | current → baseline | 630.8702 | 642.8582 | +11.9880 | — | — |
| confirmation | 3 | baseline → current | 638.7006 | 616.2104 | -22.4902 | — | — |
| confirmation | 4 | current → baseline | 613.4845 | 605.9308 | -7.5537 | — | — |
| confirmation | 5 | baseline → current | 612.4700 | 1190.5113 | +578.0413 | — | — |
| confirmation | 6 | current → baseline | 740.6501 | 613.6046 | -127.0454 | — | — |
| confirmation | 7 | baseline → current | 635.8284 | 719.0423 | +83.2140 | — | — |
| confirmation | 8 | current → baseline | 752.7675 | 744.7290 | -8.0385 | — | — |
| confirmation | 9 | baseline → current | 763.5970 | 730.8245 | -32.7725 | — | — |
| confirmation | 10 | current → baseline | 739.6153 | 762.0559 | +22.4405 | — | — |
| confirmation | 11 | baseline → current | 746.9017 | 758.3166 | +11.4149 | — | — |
| confirmation | 12 | current → baseline | 747.8781 | 764.6473 | +16.7693 | — | — |
| confirmation | 13 | baseline → current | 775.5145 | 770.8307 | -4.6837 | — | — |
| confirmation | 14 | current → baseline | 644.6990 | 763.1522 | +118.4532 | — | — |
| confirmation | 15 | baseline → current | 628.2801 | 735.9770 | +107.6969 | — | — |
| confirmation | 16 | current → baseline | 623.5840 | 632.7747 | +9.1907 | — | — |
| confirmation | 17 | baseline → current | 1209.8233 | 745.9016 | -463.9217 | — | — |
| confirmation | 18 | current → baseline | 637.9255 | 742.0473 | +104.1218 | — | — |
| confirmation | 19 | baseline → current | 747.4151 | 756.6726 | +9.2575 | — | — |
| confirmation | 20 | current → baseline | 640.7890 | 753.3795 | +112.5905 | — | — |

confirmation 成对差值中位数：11.7014ms；门禁变化：+15.7010%。

## 逐指标结果

🔴 标识所有 regression / unstable / incomplete；🟢 仅标 passed 且首批耗时下降。

### macos-0：build

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `build:weapp-vite-tailwindcss-tdesign-template:first` | 🟢 passed | -0.4935% | — |
| `build:weapp-vite-tailwindcss-tdesign-template:repeat` | 🔴 regression | +9.0242% | +8.6588% |
| `build:weapp-vite-template:first` | 🟢 passed | -2.7731% | — |
| `build:weapp-vite-template:repeat` | 🟢 passed | -5.6972% | — |
| `build:weapp-vite-wevu-template:first` | 🟢 passed | -23.3143% | — |
| `build:weapp-vite-wevu-template:repeat` | 🟢 passed | -10.0207% | — |

### ubuntu-8：auto-hmr

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `auto-hmr:1:manual:first:edit` | passed | +1.0642% | — |
| `auto-hmr:1:manual:first:restore` | 🔴 unstable | +9.8405% | -0.1843% |
| `auto-hmr:1:manual:repeat:edit` | 🟢 passed | -1.0821% | — |
| `auto-hmr:1:manual:repeat:restore` | 🟢 passed | -0.0653% | — |
| `auto-hmr:1:automatic:first:edit` | passed | +0.1949% | — |
| `auto-hmr:1:automatic:first:restore` | passed | +0.1083% | — |
| `auto-hmr:1:automatic:repeat:edit` | 🟢 passed | -1.3700% | — |
| `auto-hmr:1:automatic:repeat:restore` | passed | +1.8159% | — |
| `auto-hmr:20:manual:first:edit` | passed | +0.0122% | — |
| `auto-hmr:20:manual:first:restore` | passed | +0.3276% | — |
| `auto-hmr:20:manual:repeat:edit` | passed | +1.3965% | — |
| `auto-hmr:20:manual:repeat:restore` | 🟢 passed | -3.3002% | — |
| `auto-hmr:20:automatic:first:edit` | passed | +1.5428% | — |
| `auto-hmr:20:automatic:first:restore` | 🟢 passed | -2.0163% | — |
| `auto-hmr:20:automatic:repeat:edit` | 🟢 passed | -1.7418% | — |
| `auto-hmr:20:automatic:repeat:restore` | 🔴 unstable | +12.9746% | +1.1850% |
| `auto-hmr:50:manual:first:edit` | 🟢 passed | -2.1992% | — |
| `auto-hmr:50:manual:first:restore` | passed | +0.3198% | — |
| `auto-hmr:50:manual:repeat:edit` | 🟢 passed | -0.1457% | — |
| `auto-hmr:50:manual:repeat:restore` | 🟢 passed | -2.7220% | — |
| `auto-hmr:50:automatic:first:edit` | 🟢 passed | -0.6685% | — |
| `auto-hmr:50:automatic:first:restore` | 🔴 unstable | +15.6553% | +0.3070% |
| `auto-hmr:50:automatic:repeat:edit` | 🔴 unstable | +16.3856% | +2.3042% |
| `auto-hmr:50:automatic:repeat:restore` | 🔴 regression | +14.0088% | +15.7010% |
| `auto-hmr:69:manual:first:edit` | passed | +1.0167% | — |
| `auto-hmr:69:manual:first:restore` | 🟢 passed | -1.0694% | — |
| `auto-hmr:69:manual:repeat:edit` | 🟢 passed | -1.3582% | — |
| `auto-hmr:69:manual:repeat:restore` | 🟢 passed | -4.7321% | — |
| `auto-hmr:69:automatic:first:edit` | 🟢 passed | -1.2007% | — |
| `auto-hmr:69:automatic:first:restore` | 🟢 passed | -1.0973% | — |
| `auto-hmr:69:automatic:repeat:edit` | passed | +0.3519% | — |
| `auto-hmr:69:automatic:repeat:restore` | 🟢 passed | -0.6040% | — |

### windows-1：hmr:classic:weapp-vite-tailwindcss-tdesign-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:edit` | 🟢 passed | -10.7691% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:first:restore` | 🟢 passed | -4.3919% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:edit` | 🟢 passed | -2.4472% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:app-json:repeat:restore` | 🟢 passed | -6.4677% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:edit` | passed | +1.1154% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:first:restore` | 🟢 passed | -2.3526% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:edit` | 🟢 passed | -2.4449% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-script:repeat:restore` | 🟢 passed | -0.8695% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:edit` | 🟢 passed | -0.6955% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:first:restore` | passed | +0.3446% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:edit` | 🟢 passed | -1.0388% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-template:repeat:restore` | 🟢 passed | -1.1356% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:edit` | 🟢 passed | -0.6872% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:first:restore` | 🟢 passed | -0.1935% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:edit` | 🟢 passed | -0.4781% | — |
| `hmr:classic:weapp-vite-tailwindcss-tdesign-template:native-page-style:repeat:restore` | passed | +0.5986% | — |

### windows-4：hmr:stateful-experimental:weapp-vite-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `hmr:stateful-experimental:weapp-vite-template:app-json:first:edit` | 🟢 passed | -2.7701% | — |
| `hmr:stateful-experimental:weapp-vite-template:app-json:first:restore` | 🟢 passed | -3.9485% | — |
| `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:edit` | 🟢 passed | -1.4595% | — |
| `hmr:stateful-experimental:weapp-vite-template:app-json:repeat:restore` | 🟢 passed | -2.5549% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:edit` | 🟢 passed | -20.1920% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:first:restore` | 🟢 passed | -18.9137% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:edit` | 🟢 passed | -23.7152% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-script:repeat:restore` | 🟢 passed | -18.7989% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:edit` | 🟢 passed | -3.2881% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:first:restore` | 🔴 unstable | +7.0445% | -3.4058% |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:edit` | 🟢 passed | -6.3198% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-template:repeat:restore` | 🟢 passed | -3.7146% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:edit` | 🟢 passed | -2.2836% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-style:first:restore` | 🟢 passed | -1.7595% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:edit` | 🟢 passed | -3.5598% | — |
| `hmr:stateful-experimental:weapp-vite-template:native-page-style:repeat:restore` | 🟢 passed | -9.5065% | — |

### windows-5：hmr:classic:weapp-vite-wevu-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:edit` | passed | +3.0182% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:first:restore` | 🟢 passed | -3.8923% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:edit` | 🟢 passed | -0.6758% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-script:repeat:restore` | 🟢 passed | -0.8335% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:edit` | passed | +0.1565% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-style:first:restore` | 🟢 passed | -1.1892% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:edit` | passed | +0.7801% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-style:repeat:restore` | 🟢 passed | -2.7712% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:edit` | passed | +2.6773% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:first:restore` | 🟢 passed | -3.8055% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:edit` | 🟢 passed | -1.4467% | — |
| `hmr:classic:weapp-vite-wevu-template:vue-page-template:repeat:restore` | 🟢 passed | -2.1232% | — |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:edit` | 🔴 incomplete | — | — |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:first:restore` | 🔴 incomplete | — | — |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:edit` | 🔴 incomplete | — | — |
| `hmr:classic:weapp-vite-wevu-template:json-sitemap:repeat:restore` | 🔴 incomplete | — | — |

### windows-6：hmr:stateful-experimental:weapp-vite-wevu-template

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:edit` | 🟢 passed | -2.7869% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:first:restore` | 🟢 passed | -7.0963% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:edit` | 🟢 passed | -7.0671% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-script:repeat:restore` | 🟢 passed | -12.2221% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:edit` | 🟢 passed | -0.9693% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:first:restore` | 🟢 passed | -0.4053% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:edit` | 🟢 passed | -1.6917% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-style:repeat:restore` | 🟢 passed | -0.6637% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:edit` | 🟢 passed | -3.0325% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:first:restore` | 🟢 passed | -6.1913% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:edit` | 🟢 passed | -1.2645% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:vue-page-template:repeat:restore` | 🟢 passed | -2.2524% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:edit` | 🟢 passed | -2.0398% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:first:restore` | 🟢 passed | -2.8709% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:edit` | 🟢 passed | -1.3235% | — |
| `hmr:stateful-experimental:weapp-vite-wevu-template:json-sitemap:repeat:restore` | 🟢 passed | -1.4623% | — |

### windows-7：auto-build

| 指标 | 状态 | 首批变化 | 唯一确认变化 |
| --- | --- | ---: | ---: |
| `auto-build:1:manual:first` | 🟢 passed | -12.9923% | — |
| `auto-build:1:manual:repeat` | 🟢 passed | -9.4988% | — |
| `auto-build:1:automatic:first` | 🟢 passed | -8.7206% | — |
| `auto-build:1:automatic:repeat` | 🟢 passed | -9.4426% | — |
| `auto-build:20:manual:first` | 🟢 passed | -9.3638% | — |
| `auto-build:20:manual:repeat` | 🟢 passed | -8.5223% | — |
| `auto-build:20:automatic:first` | 🟢 passed | -10.3571% | — |
| `auto-build:20:automatic:repeat` | 🟢 passed | -10.4571% | — |
| `auto-build:50:manual:first` | 🟢 passed | -9.7265% | — |
| `auto-build:50:manual:repeat` | 🟢 passed | -8.8960% | — |
| `auto-build:50:automatic:first` | 🟢 passed | -10.6523% | — |
| `auto-build:50:automatic:repeat` | 🟢 passed | -10.2360% | — |
| `auto-build:69:manual:first` | 🟢 passed | -8.6885% | — |
| `auto-build:69:manual:repeat` | 🟢 passed | -4.8153% | — |
| `auto-build:69:automatic:first` | 🔴 unstable | +7.3471% | -8.5395% |
| `auto-build:69:automatic:repeat` | 🔴 unstable | +6.5909% | -8.4030% |

## 原始证据完整性

以下 gzip 无损保存采集器顶层报告；采集器已脱敏 checkout 路径。原始分片内子日志也保留在下载目录中。SHA256 对应解压后的字节。

| 报告 | 字节数 | SHA256 |
| --- | ---: | --- |
| [macos-0](./nightly-pr1085-36198019403-macos-0.json.gz) | 99657 | `decc7040bed6d407825b36cfa72d46708df603e28e30fd9b8d971dd42b1bd93a` |
| [ubuntu-8](./nightly-pr1085-36198019403-ubuntu-8.json.gz) | 263605 | `ffb2d4f35fb714fe1e8a33e99221602b45f00ea3fbfca2c76b623e71465d8c57` |
| [windows-1](./nightly-pr1085-36198019403-windows-1.json.gz) | 2030086 | `459d0b459a2e364dce5b64836590d4e7ff14e67745d9644304fd3822ce6d52a7` |
| [windows-4](./nightly-pr1085-36198019403-windows-4.json.gz) | 390806 | `ed771cbf5862c62db8d2ec4249a2adf61451a5106fec48c3e8eb2431fe6d9714` |
| [windows-5](./nightly-pr1085-36198019403-windows-5.json.gz) | 2123016 | `f45be0c5fd8a3d92f70184d426c5ef07ecd69cd5219817cda319a00ffe6df0d9` |
| [windows-6](./nightly-pr1085-36198019403-windows-6.json.gz) | 389168 | `fadf35f8d147d84ba99a8755384ff269bbc19ac77b3bd1215b760b35f5039a08` |
| [windows-7](./nightly-pr1085-36198019403-windows-7.json.gz) | 96887 | `a96e87099ac7514e7e00071b0348f67b76a066d0f1787af6967ea2eb0fd038df` |
