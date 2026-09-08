# weapp-tailwindcss 5.5.2 升级记录

2026-09-08 核实 npm latest 为 5.5.2，2026-09-09 再次复核未变。本次从 5.5.1 升级默认 catalog、固定版本回归 catalog、锁文件和脚手架生成的依赖映射。

## 上游变更与集成边界

依据 [5.5.2 官方 changelog](https://github.com/sonofmagic/weapp-tailwindcss/blob/be518d94790c29aad401220b5cdb2a5d23173d5f/packages/weapp-tailwindcss/CHANGELOG.md#552) 和两个 npm 发布包的公开类型、实现对比：

- `weapp-tailwindcss/core` 的编译器公开签名未变，现有 `createCompiler`、`generate`、snapshot 与失效生命周期继续适用。
- 底层生成器使用 CSS tokenizer 解析导入和 `source()`，修复转义路径、Windows 路径序列化、删除文件时的符号链接身份处理，并补充 qxml 扫描。
- `@weapp-tailwindcss/postcss` 升级到 3.3.3，`weapp-style-injector` 升级到 1.0.5。
- Node 要求保持 `^22.18.0 || >=24.11.0`，Tailwind CSS 继续使用 4.x。

转义路径的验证范围须区分：真实 Core 回归覆盖了 `source("./source\20 pages")` 扫描空格目录；升级审计中，`@import "./styles\20 with\20 spaces/tailwind.css"` 仍被 enhanced-resolve 按含转义的原字符串解析并失败。后者是当前 fixture 未使用的上游探索边界，未计入通过用例，也未由本次 adapter 迁移修复。不能据 tokenizer 变更宣称所有 CSS import 转义均已支持。

weapp-vite 使用自己的 Core adapter，继续由单个编译器拥有 Tailwind 生成，CSS 入口使用被项目实际导入的纯 CSS 文件，并从项目根目录解析为绝对路径。此次补丁升级不需要替换 API 或重复注册上游 Vite 插件。

前置插件生成的 CSS 通过 Core 的 `sourceOptions.cssSources` 传入，保留 `file`、`base` 与依赖身份。adapter 在用户 pre 插件之后捕获内存源码，再生成入口标记；同一入口不会同时从磁盘重新读取。外链 SFC 样式保持原请求身份，热更新继续通过对应源文件失效。#779 回归以 pre 注入的 `@apply p-[13px]` 编译结果和真实 IDE 的 13px padding、文本及颜色共同验收，单纯存在普通 CSS 规则或已展开 Tailwind 导入不能证明编译完成。

SFC 样式仍由 Vue loader 完成 scoped、预处理和依赖登记；引用同一 CSS 的不同 SFC 样式块分别保存转换源码，避免作用域互相覆盖。源文件失效后必须重新执行转换，生成阶段拒绝使用失效前的内存 CSS。转换后的样式来源会与 loader 元数据合并，继续由原 owner 交给 Vite/Rolldown 写出。

上游官方 Vite 插件的 CSS 合并和缓存修复不能直接代表自研 adapter 已获得相同修复。微信 IDE 连续更新中 WXSS 编译缺失的 [跟踪项 #977](https://github.com/weapp-vite/weapp-vite/issues/977) 仍以真实 IDE 的计算样式、DOM 和状态保留结果独立验收。

## 验证入口

现有 adapter、输出所有权和 HMR 单测验证调用契约，真实 Core 回归验证 CSS 路径和模板失效语义。下游覆盖使用：

`packages/weapp-vite/test-d/config-public-types/tailwind-public.test-d.ts` 直接引用 `weapp-vite/config`、`weapp-vite/types` 和上游 Core 发布类型，校验编译器回调、内存 CSS 来源选项及错误类型负例。该目录使用 NodeNext 消费真实发布声明，通过显式 `--files "**/*.test-d.ts"` 收集每个契约文件，避免 tsd 默认只执行 `index.test-d.ts` 而遗漏新增测试。最终通过状态以完整类型命令的结果为准。

```sh
pnpm --filter weapp-vite typecheck
pnpm --filter weapp-vite test:types
pnpm --filter weapp-vite build
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/template-tailwind-v4-source.build.test.ts e2e/ci/template-tailwind-hmr.test.ts e2e/ci/issue-814-tailwind-dynamic-class.e2e.test.ts
pnpm e2e:ide:full:exhaustive
```

所有 E2E 串行执行，最终通过状态读取对应提交的严格验收报告；此记录本身不代表全量测试已经通过。
