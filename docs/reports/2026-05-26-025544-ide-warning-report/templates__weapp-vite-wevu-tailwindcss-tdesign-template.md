# IDE Warning/Error 项目报告：templates/weapp-vite-wevu-tailwindcss-tdesign-template

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`0/3/3/0/0`
- 页面快照：`0`
- 总问题数：`3`
- 普通运行时日志：`3`
- type-uncompatible 命中数：`0`

## 2. 所有 Warning/Error

1. `1` 次：`[runtime/launch-recover/warn] clean=compile`
   - 示例原始行：`[warn] [runtime:launch-recover] clean=compile`

2. `1` 次：`[runtime/launch-recover/warn] cleanup-devtools`
   - 示例原始行：`[warn] [runtime:launch-recover] cleanup-devtools`

3. `1` 次：`[runtime/devtools-log/warn] connect bridge: [2026-05-26 02:55:54.947][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect bridge: [2026-05-26 02:55:54.947][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

## 3. Type-Uncompatible 子集

- 未命中 `received type-uncompatible value`。

## 4. Build Stats 样本

1. `ide:weapp-vite-wevu-tailwindcss-tdesign-template` -> warn=0 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=0 error=0 exception=0 total=0`
2. `log=0 info=0 warn=0 error=0 exception=0 total=0`

## 6. 普通 Runtime Logs

1. `1` 次：`[runtime/launch-recover/info] cleaned=compile`
   - 示例原始行：`[info] [runtime:launch-recover] cleaned=compile`

2. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:61202`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:61202`

3. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:61626`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:61626`

## 7. 页面内容快照

- 未采集到页面内容快照。
