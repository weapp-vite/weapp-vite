# 2026-10-08 依赖审计差异

按同日 registry advisory 数据比较升级前后锁文件。pnpm 项数为 advisory 数量；npm 项数包含受影响的间接父包，不能直接横向比较。未添加忽略项或跨范围 override。

| pnpm audit | low | moderate | high | critical | 合计 |
| --- | --- | --- | --- | --- | --- |
| 升级前 | 5 | 21 | 27 | 10 | 63 |
| 升级后 | 5 | 18 | 20 | 9 | 52 |

## 剩余上游依赖链

下表列出代表性路径。已升级父包至本轮兼容稳定版；修复版本超出父包约束、精确固定或上游没有修复时，保留现有约束。例：Monaco 固定 DOMPurify 3.4.15、oxfmt 固定 Tinypool 2.1.0、cos-wx-sdk-v5 固定 fast-xml-parser 4.5.0。将它们改为上游未声明的版本不属于兼容更新。

| 包 | 剩余解析版本 | 等级 | advisory 数 | 代表性来源 |
| --- | --- | --- | --- | --- |
| got | 8.3.2 | moderate | 1 | . → minidev → download → got |
| request | 2.88.2 | moderate | 1 | . → minidev → request |
| tough-cookie | 2.5.0 | moderate | 1 | . → minidev → request → tough-cookie |
| ip | 1.1.9 | high | 1 | . → minidev → superagent-proxy → proxy-agent → pac-proxy-agent → pac-resolver → ip |
| http-cache-semantics | 3.8.1 | high | 2 | . → minidev → download → got → cacheable-request → http-cache-semantics |
| form-data | 2.3.3 | critical、high | 2 | . → minidev → request → form-data |
| postcss | 7.0.39 | moderate、high | 5 | apps/vite-native → miniprogram-simulate → postcss |
| tar | 6.2.1 | high、moderate、critical | 12 | . → minidev → tar |
| fast-xml-parser | 4.5.0 | critical、high、low、moderate | 6 | apps/vite-native → cos-wx-sdk-v5 → fast-xml-parser |
| qs | 6.5.5 | moderate | 2 | . → minidev → request → qs |
| @tootallnate/once | 1.1.2 | low | 1 | . → minidev → superagent-proxy → proxy-agent → http-proxy-agent → @tootallnate/once |
| uuid | 3.4.0 | moderate | 1 | . → minidev → request → uuid |
| decompress | 4.2.1 | critical、moderate | 4 | . → minidev → download → decompress |
| decode-uri-component | 0.2.2 | moderate | 1 | . → minidev → download → got → cacheable-request → normalize-url → query-string → decode-uri-component |
| dompurify | 3.4.15 | low | 2 | packages/dashboard → monaco-editor → dompurify |
| braces | 3.0.3 | high | 1 | apps/vite-native → weapp-tailwindcss → weapp-style-injector → micromatch → braces |
| @simple-git/argv-parser | 1.1.1 | critical | 1 | . → repoctl → @icebreakers/monorepo → simple-git → @simple-git/argv-parser |
| simple-git | 3.36.0 | critical、high | 3 | . → repoctl → @icebreakers/monorepo → simple-git |
| sprintf-js | 1.0.3 | moderate | 1 | apps/api-extractor-vue-types-demo → @microsoft/api-extractor → @rushstack/ts-command-line → argparse → sprintf-js |
| katex | 0.16.47 | low | 1 | templates/weapp-vite-template → @icebreakers/eslint-config → @antfu/eslint-config → @eslint/markdown → micromark-extension-math → katex |
| tinypool | 2.1.0 | critical | 2 | templates/weapp-vite-template → @icebreakers/eslint-config → @antfu/eslint-config → eslint-plugin-format → oxfmt → tinypool |
| sharp | 0.35.4 | high | 1 | website → wrangler → miniflare → sharp |

## 独立 npm runner

`tools/miniprogram-ci-runner` 继续使用官方 miniprogram-ci 2.1.31；在其原约束内刷新间接依赖，并通过独立 `npm ci --ignore-scripts` 安装，没有执行预览或上传。

| npm audit | low | moderate | high | critical | 合计 |
| --- | --- | --- | --- | --- | --- |
| 升级前 | 1 | 27 | 17 | 41 | 86 |
| 升级后 | 1 | 27 | 17 | 41 | 86 |

独立 runner 的告警总数未变化。主要链路包含官方 SDK 的旧 request、Babel、COS 和已停止维护的压缩解包依赖；npm audit fix 的跨范围替换不在本轮范围内。
