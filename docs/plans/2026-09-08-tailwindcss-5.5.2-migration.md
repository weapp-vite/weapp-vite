# weapp-tailwindcss 5.5.2 升级记录

2026-09-08 核实 npm latest 为 5.5.2。本次从 5.5.1 升级默认 catalog、固定版本回归 catalog、锁文件和脚手架生成的依赖映射。

## 上游变更与集成边界

依据 [5.5.2 官方 changelog](https://github.com/sonofmagic/weapp-tailwindcss/blob/be518d94790c29aad401220b5cdb2a5d23173d5f/packages/weapp-tailwindcss/CHANGELOG.md#552) 和两个 npm 发布包的公开类型、实现对比：

- `weapp-tailwindcss/core` 的编译器公开签名未变，现有 `createCompiler`、`generate`、snapshot 与失效生命周期继续适用。
- 底层生成器使用 CSS tokenizer 解析导入和 `source()`，修复转义路径、Windows 路径序列化、删除文件时的符号链接身份处理，并补充 qxml 扫描。
- PostCSS 依赖升级到 3.3.3，样式注入器升级到 1.0.5。
- Node 要求保持 `^22.18.0 || >=24.11.0`，Tailwind CSS 继续使用 4.x。

weapp-vite 使用自己的 Core adapter，继续由单个编译器拥有 Tailwind 生成，CSS 入口使用被项目实际导入的纯 CSS 文件，并从项目根目录解析为绝对路径。此次补丁升级不需要替换 API 或重复注册上游 Vite 插件。

上游官方 Vite 插件的 CSS 合并和缓存修复不能直接代表自研 adapter 已获得相同修复。微信 IDE 连续更新中 WXSS 编译缺失的 [跟踪项 #977](https://github.com/weapp-vite/weapp-vite/issues/977) 仍以真实 IDE 的计算样式、DOM 和状态保留结果独立验收。

## 验证入口

现有 adapter、输出所有权和 HMR 单测验证调用契约，真实 Core 回归验证 CSS 路径和模板失效语义。下游覆盖使用：

```sh
pnpm --filter weapp-vite typecheck
pnpm --filter weapp-vite test:types
pnpm --filter weapp-vite build
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/template-tailwind-v4-source.build.test.ts e2e/ci/template-tailwind-hmr.test.ts e2e/ci/issue-814-tailwind-dynamic-class.e2e.test.ts
pnpm e2e:ide:full:exhaustive
```

所有 E2E 串行执行，最终通过状态读取对应提交的严格验收报告；此记录本身不代表全量测试已经通过。
