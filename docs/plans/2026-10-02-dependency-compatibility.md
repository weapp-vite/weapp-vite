# #1132：发布消费者的 CSS 与 TypeScript 兼容性

## 已复现的问题

独立项目安装 `weapp-vite@7.4.0` 与 `typescript@6.0.3`，启用 pnpm 严格 peer 校验时，`weapp-vite → vite-tsconfig-paths@6.1.1 → tsconfck@3.1.6` 的可选 TypeScript peer 仅接受 `^5.0.0`。构建成功不能消除这项声明冲突。

框架默认别名提取还有独立的语义问题：忽略 `extends` 数组、忽略包配置继承，并将子配置 `paths` 与父配置逐项合并。这与 TypeScript 的整张映射覆盖行为不一致。对应回归先失败，再由统一配置解析修复。

## 实现及边界

- 默认别名提取使用 `get-tsconfig@^4.14.3` 解析继承及路径来源，保留项目引用遍历、循环保护、受管配置尚未生成时的 prepare 容错，以及原先无 `baseUrl` 时接受 `src/*` 的行为。
- 高级选项精确固定 `vite-tsconfig-paths@7.0.0-alpha.3`，其依赖为 `get-tsconfig` 与 `oxc-resolver`，不再引入 tsconfck。该版本是预发行版，版本不使用宽泛范围。
- 旧 `parseNative` 配置仍被框架类型接受并标记弃用。新适配器统一解析配置，该开关不再加载 TypeScript 编译器；公开类型回归覆盖旧配置及错误参数。
- 简单别名不表达中间通配符；发布消费者用高级模式验证 `@pattern/*/data`。包继承的实际构建使用显式包内 JSON 文件路径。Vite/Oxc 配置加载仍不识别包 `package.json` 的自定义 `tsconfig` 入口字段，使用此类包时应显式指定文件；内部别名提取支持该字段，不代表所有宿主加载器支持。

## CSS 调查

本轮独立 pnpm 安装实际选择：

| 依赖 | 版本 | 相关 peer |
| --- | --- | --- |
| `@csstools/css-parser-algorithms` | 4.0.1 | tokenizer `^4.0.2` |
| `@csstools/css-color-parser` | 4.2.4 | parser-algorithms `^4.0.1` |
| `@csstools/css-calc` | 3.4.1 | parser-algorithms `^4.0.1` |

引入路径为 `weapp-vite → weapp-tailwindcss → @weapp-tailwindcss/postcss → postcss-preset-env`，以及同一 postcss 包对颜色工具的直接依赖。本轮严格安装没有复现 CSS peer 冲突，因此不添加 CSS override，也不以仓库锁文件变更声称修复消费端。

通过安装包的 `weapp-tailwindcss/core` 实际转换：现代 HSL 转为兼容逗号形式，`color(srgb 1 0 0 / 0.5)` 转为 `rgba(255, 0, 0, 0.5)`，红蓝等比例 `color-mix` 转为 `rgb(128, 0, 128)`。

## 可复验入口

先重建候选，然后运行独立消费者：

```sh
pnpm exec turbo run build --filter=weapp-vite... --filter=rolldown-require...
node packages/weapp-vite/scripts/verify-dependency-install.mjs pnpm
node packages/weapp-vite/scripts/verify-dependency-install.mjs npm
```

消费者位于系统临时目录。完整框架闭包先打 tarball，安装后验证 provenance。pnpm 的候选映射仅作用于尚未发布的本仓库包；外部依赖版本和 peer 声明均不覆盖。pnpm 12 的设置写入独立 `pnpm-workspace.yaml`，不会读取维护仓库的 workspace 或 peer 忽略设置。

`WEAPP_VITE_DEPENDENCY_EVIDENCE` 可指定 JSON 证据输出，记录 Node、包管理器、版本、peer 与语义结果。CI 增加三系统 npm/pnpm 严格消费任务；原有三系统最低及当前 Node 矩阵也执行路径/CSS 语义验证。

已通过本地定向单测 73 项、包级 typecheck、公开类型测试、包构建、网站构建，以及 pnpm 12.8.1 / Node 24.18.0 的严格安装、prepare、TS6 零诊断及默认/原生/高级三种生产构建。npm、其他系统和最低 Node 的当轮结果需由候选提交继续验证。此报告不宣称真实微信 IDE 运行时验收完成。
