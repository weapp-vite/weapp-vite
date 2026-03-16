# weapp-vite app 级实测报告：AST 引擎切换对 dev / build / HMR 的影响

## 1. 报告目标

本文回答的问题不是 AST 微基准，而是更贴近日常开发体验的问题：

- 在 `weapp-vite` 的真实 app 上，`ast.engine = 'oxc'` 相比 `ast.engine = 'babel'`
  - `build` 会快多少
  - `dev` 首次启动会快多少
  - 热更新会快多少

## 2. 测试范围

本次选了 3 个代表性 app：

1. [`apps/vite-native-ts`](/Users/yangqiming/Documents/GitHub/weapp-vite/apps/vite-native-ts)
   原生 TS 小程序项目，`srcRoot = miniprogram`
2. [`apps/wevu-vue-demo`](/Users/yangqiming/Documents/GitHub/weapp-vite/apps/wevu-vue-demo)
   Vue SFC + wevu 项目
3. [`apps/tdesign-miniprogram-starter-retail`](/Users/yangqiming/Documents/GitHub/weapp-vite/apps/tdesign-miniprogram-starter-retail)
   更接近真实业务体量的原生商城 demo

额外说明：

- 我尝试了 [`apps/wevu-comprehensive-demo`](/Users/yangqiming/Documents/GitHub/weapp-vite/apps/wevu-comprehensive-demo)，但它在当前环境下 build 链过长且存在多阶段长时间 transform，难以在同一口径下稳定拿到干净数据，因此没有纳入最终对比表。

## 3. 测试环境

- 时间：`2026-03-16`
- 系统：`Darwin 25.3.0 arm64`
- Node.js：`v22.20.0`
- `oxc-parser`：`0.120.0`
- `@babel/parser`：`7.29.0`
- 命令入口：`node packages/weapp-vite/bin/weapp-vite.js`

## 4. 测试方法

### 4.1 配置切换方式

每个 app 都临时生成两份 config：

- `ast: { engine: 'babel' }`
- `ast: { engine: 'oxc' }`

其余配置保持不变。

### 4.2 build 口径

执行：

```bash
node packages/weapp-vite/bin/weapp-vite.js build <app> --config <temp-config> --clearScreen false --skipNpm
```

记录口径：

- 使用 `weapp-vite` CLI 自己打印的 `构建完成，耗时 xxx ms`

说明：

- 统一使用 `--skipNpm`
- 原因是 npm 依赖复制/构建时间本身不由 AST 引擎决定，不适合混入对比

### 4.3 dev 冷启动口径

执行：

```bash
node packages/weapp-vite/bin/weapp-vite.js dev <app> --config <temp-config> --clearScreen false --skipNpm
```

记录口径：

- 使用 `weapp-vite` CLI 首次打印的 `构建完成，耗时 xxx ms`

为了避免本机 watcher 的 `EMFILE` 干扰，dev 场景统一设置：

- `WEAPP_VITE_DISABLE_SIDECAR_WATCH=1`
- `CHOKIDAR_USEPOLLING=1`
- `CHOKIDAR_INTERVAL=120`

### 4.4 HMR 口径

HMR 场景直接在 dev 进程存活状态下修改真实源文件，等待 CLI 输出：

- `✔ [update] ...`
- `✔ 构建完成，耗时 xxx ms`

同时检查对应 dist 文件已包含新的 marker，确认不是误触发。

本次 HMR 改动点：

- `vite-native-ts`：修改 [`apps/vite-native-ts/miniprogram/pages/index/index.ts`](/Users/yangqiming/Documents/GitHub/weapp-vite/apps/vite-native-ts/miniprogram/pages/index/index.ts) 的 `motto`
- `wevu-vue-demo`：修改 [`apps/wevu-vue-demo/src/pages/index/index.vue`](/Users/yangqiming/Documents/GitHub/weapp-vite/apps/wevu-vue-demo/src/pages/index/index.vue) 的 `navigationBarTitleText`
- `tdesign-miniprogram-starter-retail`：修改 [`apps/tdesign-miniprogram-starter-retail/pages/home/home.js`](/Users/yangqiming/Documents/GitHub/weapp-vite/apps/tdesign-miniprogram-starter-retail/pages/home/home.js) 的 `Toast message`

## 5. 实测结果

### 5.1 总表

| App                                  | 模式         |       Babel |         Oxc | 结果                    |
| ------------------------------------ | ------------ | ----------: | ----------: | ----------------------- |
| `vite-native-ts`                     | build        |    `265 ms` |    `251 ms` | Oxc 快 `5.3%`           |
| `vite-native-ts`                     | dev 首次构建 | `138.95 ms` | `121.28 ms` | Oxc 快 `12.7%`          |
| `vite-native-ts`                     | HMR          | `139.22 ms` |  `89.17 ms` | Oxc 快 `35.9%`          |
| `wevu-vue-demo`                      | build        |    `960 ms` |    `964 ms` | Oxc 慢 `0.4%`，基本持平 |
| `wevu-vue-demo`                      | dev 首次构建 | `773.99 ms` | `719.40 ms` | Oxc 快 `7.1%`           |
| `wevu-vue-demo`                      | HMR          | `521.22 ms` | `512.22 ms` | Oxc 快 `1.7%`           |
| `tdesign-miniprogram-starter-retail` | build        |    `555 ms` |    `857 ms` | Oxc 慢 `54.4%`          |
| `tdesign-miniprogram-starter-retail` | dev 首次构建 | `621.54 ms` | `610.91 ms` | Oxc 快 `1.7%`           |
| `tdesign-miniprogram-starter-retail` | HMR          | `380.11 ms` | `368.74 ms` | Oxc 快 `3.0%`           |

### 5.2 分项目观察

#### 5.2.1 `vite-native-ts`

这是本次 Oxc 收益最明显的样本之一。

- build：从 `265 ms` 降到 `251 ms`
- dev：从 `138.95 ms` 降到 `121.28 ms`
- HMR：从 `139.22 ms` 降到 `89.17 ms`

结论：

- 对原生 TS 项目，Oxc 在 `dev` 和 HMR 上收益很明显
- 尤其 HMR，接近三分之一的降幅

#### 5.2.2 `wevu-vue-demo`

这个项目更能代表 Vue SFC + wevu 的真实编译链。

- build：`960 ms` vs `964 ms`，几乎没差
- dev：`773.99 ms` vs `719.40 ms`
- HMR：`521.22 ms` vs `512.22 ms`

结论：

- Oxc 在这个样本上对生产 build 没有形成优势
- 但在开发期仍然有稳定小幅提升
- 说明 Vue/wevu 相关 transform 的成本，已经明显盖过纯 AST parse 的收益

#### 5.2.3 `tdesign-miniprogram-starter-retail`

这是本次最关键的反例。

- build：Babel `555 ms`，Oxc `857 ms`
- dev：Babel `621.54 ms`，Oxc `610.91 ms`
- HMR：Babel `380.11 ms`，Oxc `368.74 ms`

结论：

- 在这个更业务化、分包和组件较多的样本上，Oxc 没有把 build 变快，反而显著变慢
- 但在 `dev` 冷启动和 HMR 上，Oxc 仍然略快

这说明：

- AST 引擎切换对开发期扫描/分析有帮助
- 但到了生产构建链路，其他 transform、chunk 处理、分包处理、输出流程才是更大的瓶颈

## 6. 汇总结论

### 6.1 dev 模式

本次 3 个 app 的 dev 首次构建里：

- `vite-native-ts`：Oxc 快 `12.7%`
- `wevu-vue-demo`：Oxc 快 `7.1%`
- `retail`：Oxc 快 `1.7%`

结论：

- Oxc 在 dev 冷启动上整体偏正收益
- 但幅度不是固定倍数，更像 `1.7%` 到 `12.7%` 的区间

### 6.2 HMR

本次 3 个 app 的热更新里：

- `vite-native-ts`：Oxc 快 `35.9%`
- `wevu-vue-demo`：Oxc 快 `1.7%`
- `retail`：Oxc 快 `3.0%`

结论：

- HMR 的收益也不均匀
- 原生 TS 项目最明显
- Vue / 业务项目则只有小幅改善

### 6.3 build

本次 3 个 app 的 build 里：

- `vite-native-ts`：Oxc 快 `5.3%`
- `wevu-vue-demo`：基本持平
- `retail`：Oxc 慢 `54.4%`

结论：

- 生产 build 不能简单认为 Oxc 一定更快
- 在 app 级构建链路里，AST parse 只是其中一段
- 一旦其他插件、chunk、分包、本地化 runtime、输出发射占主导，Oxc 的 parser 优势就可能被吞没，甚至出现负收益

## 7. 最重要的工程判断

基于这次 app 级实测，可以得出一个比 AST 微基准更有价值的结论：

1. `Oxc` 对 `weapp-vite` 的主要收益更偏向开发期。
2. 具体来说，收益最稳定的是：
   - `dev` 首次构建
   - HMR / 增量更新
3. 对 `build` 而言，收益并不稳定，甚至可能明显变慢。

换句话说：

- 如果目标是改善开发期体感，切 Oxc 是有现实价值的
- 如果目标是保证所有 app 的生产构建都更快，当前数据不支持这个结论

## 8. 对外表述建议

如果后续要对外描述，不建议说：

- `weapp-vite` 切到 Oxc 后，dev/build/HMR 都会明显更快

更准确的说法应该是：

- 在 `weapp-vite` 当前 app 级实测中，Oxc 在开发期通常更快，尤其对原生 TS 项目的 HMR 改善明显
- 但生产 build 的收益不稳定，具体结果高度依赖项目结构和后续插件链成本

## 9. 后续建议

如果要继续把这份结论做扎实，下一步建议补三类测量：

1. 同一个 app 跑 `3~5` 轮，取平均值和中位数
2. 增加 `wevu-comprehensive-demo` 这种更大规模的 Vue/wevu 样本
3. 对 build 阶段拆 plugin timing，确认到底是 AST 本身、Vue transform、分包处理还是 chunk 发射吞掉了 Oxc 收益
