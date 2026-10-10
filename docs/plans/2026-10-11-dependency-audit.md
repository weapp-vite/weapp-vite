# 2026-10-11 依赖审计差异

按本轮查询到的 registry advisory 比较升级前后锁文件。pnpm 数量为 advisory 数，npm 数量还包含受影响的父包，两者不能直接横向比较。没有新增忽略项或跨范围 override。

| pnpm audit | low | moderate | high | critical | 合计 |
| --- | --- | --- | --- | --- | --- |
| 升级前 | 5 | 18 | 18 | 7 | 48 |
| 升级后 | 5 | 18 | 17 | 7 | 47 |

Wrangler 4.149.0 的上游链路移除旧 sharp 0.35.4，统一使用 0.35.5，消除了高危 advisory [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)。其余 advisory ID 集合保持不变。

## 剩余上游依赖链

下表列出代表性路径；这些依赖来自已保留的父包约束或精确固定。Monaco 固定 DOMPurify 3.4.15、oxfmt 固定 Tinypool 2.1.0、cos-wx-sdk-v5 固定 fast-xml-parser 4.5.0。没有用父包未声明的版本覆盖它们。

| 包 | 解析版本 | 等级 | advisory 数 | 代表性来源 |
| --- | --- | --- | --- | --- |
| @tootallnate/once | 1.1.2 | low | 1 | . → minidev → superagent-proxy → proxy-agent → pac-proxy-agent → get-uri → @tootallnate/once |
| braces | 3.0.3 | high | 1 | templates/weapp-vite-multi-platform-sfc-template → @icebreakers/eslint-config → @icebreakers/stylelint-config → stylelint-order → stylelint → fast-glob → micromatch → braces |
| decode-uri-component | 0.2.2 | moderate | 1 | . → minidev → download → got → cacheable-request → normalize-url → query-string → decode-uri-component |
| decompress | 4.2.1 | critical、moderate | 4 | . → minidev → download → decompress |
| dompurify | 3.4.15 | low | 2 | packages/dashboard → monaco-editor → dompurify |
| fast-xml-parser | 4.5.0 | critical、high、low、moderate | 6 | apps/vite-native → cos-wx-sdk-v5 → fast-xml-parser |
| form-data | 2.3.3 | critical、high | 2 | . → minidev → request-promise-native → request-promise-core → request → form-data |
| got | 8.3.2 | moderate | 1 | . → minidev → download → got |
| http-cache-semantics | 3.8.1 | high | 2 | . → minidev → download → got → cacheable-request → http-cache-semantics |
| ip | 1.1.9 | high | 1 | . → minidev → superagent-proxy → proxy-agent → pac-proxy-agent → pac-resolver → ip |
| katex | 0.16.47 | low | 1 | templates/weapp-vite-multi-platform-sfc-template → @icebreakers/eslint-config → @antfu/eslint-config → @eslint/markdown → micromark-extension-math → katex |
| postcss | 7.0.39 | moderate、high | 5 | apps/vite-native → miniprogram-simulate → postcss |
| qs | 6.5.5 | moderate | 2 | . → minidev → request-promise-native → request-promise-core → request → qs |
| request | 2.88.2 | moderate | 1 | . → minidev → request-promise-native → request-promise-core → request |
| sprintf-js | 1.0.3 | moderate | 1 | apps/api-extractor-vue-types-demo → @microsoft/api-extractor → @rushstack/ts-command-line → argparse → sprintf-js |
| tar | 6.2.1 | high、moderate、critical | 12 | . → minidev → tar |
| tinypool | 2.1.0 | critical | 2 | templates/weapp-vite-multi-platform-sfc-template → @icebreakers/eslint-config → eslint-plugin-format → oxfmt → tinypool |
| tough-cookie | 2.5.0 | moderate | 1 | . → minidev → request-promise-native → request-promise-core → request → tough-cookie |
| uuid | 3.4.0 | moderate | 1 | . → minidev → request-promise-native → request-promise-core → request → uuid |

## 独立 npm runner

tools/miniprogram-ci-runner 继续使用官方 miniprogram-ci 2.1.31。在原约束内刷新 baseline-browser-mapping 和 electron-to-chromium，并完成 npm ci --ignore-scripts；没有执行预览、上传或远程发布。

| npm audit | low | moderate | high | critical | 合计 |
| --- | --- | --- | --- | --- | --- |
| 升级前 | 1 | 27 | 17 | 41 | 86 |
| 升级后 | 1 | 27 | 17 | 41 | 86 |

剩余链路主要涉及官方 SDK 的旧 request、Babel、COS 及压缩解包依赖。npm audit fix 的跨范围替换不在本轮兼容升级范围内。

## 既有 peer 限制

pnpm peers check 仍返回以下既有冲突；本轮没有通过修改 peer 范围、忽略规则或 override 隐藏它们。框架独立消费者采用严格 peer 与 engine 校验，验证结果另见升级报告。

| 父包 | 声明要求 | 工作区既有版本 |
| --- | --- | --- |
| unbuild 3.6.1 | TypeScript ^5.9.2 | 6.0.3 |
| graphql-request 7.4.0 | GraphQL 14–16 | 17.0.2 |
| vitepress-plugin-mermaid 2.0.17 | Mermaid 10 或 11 | 12.1.0 |
| vitepress-plugin-mermaid 2.0.17 | VitePress 1.x | 2.0.0-alpha.20 |
