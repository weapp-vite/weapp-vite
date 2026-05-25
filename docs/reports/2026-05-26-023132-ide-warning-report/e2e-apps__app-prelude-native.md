# IDE Warning/Error 项目报告：e2e-apps/app-prelude-native

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`0/2/6/0/0`
- 页面快照：`0`
- 总问题数：`6`
- 普通运行时日志：`2`
- type-uncompatible 命中数：`0`

## 2. 所有 Warning/Error

1. `2` 次：`[runtime/launch-recover/warn] cleanup-devtools`
   - 示例原始行：`[warn] [runtime:launch-recover] cleanup-devtools`

2. `1` 次：`[runtime/launch-recover/warn] clean=all`
   - 示例原始行：`[warn] [runtime:launch-recover] clean=all`

3. `1` 次：`[runtime/launch-recover/warn] clean=compile`
   - 示例原始行：`[warn] [runtime:launch-recover] clean=compile`

4. `1` 次：`[runtime/devtools-log/warn] connect direct: [2026-05-26 02:33:02.264][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect direct: [2026-05-26 02:33:02.264][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

5. `1` 次：`[runtime/devtools-log/warn] connect direct: [2026-05-26 02:33:30.397][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect direct: [2026-05-26 02:33:30.397][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

## 3. Type-Uncompatible 子集

- 未命中 `received type-uncompatible value`。

## 4. Build Stats 样本

1. `ide:app-prelude-native:inline` -> warn=0 error=0 exit=0
2. `ide:app-prelude-native:default` -> warn=0 error=0 exit=0
3. `ide:app-prelude-native:default` -> warn=0 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=0 error=0 exception=0 total=0`
2. `log=0 info=0 warn=0 error=0 exception=0 total=0`
3. `log=0 info=0 warn=0 error=0 exception=0 total=0`
4. `log=0 info=0 warn=0 error=0 exception=0 total=0`
5. `log=0 info=0 warn=0 error=0 exception=0 total=0`

## 6. 普通 Runtime Logs

1. `1` 次：`[runtime/launch-recover/info] cleaned=all`
   - 示例原始行：`[info] [runtime:launch-recover] cleaned=all`

2. `1` 次：`[runtime/launch-recover/info] cleaned=compile`
   - 示例原始行：`[info] [runtime:launch-recover] cleaned=compile`

## 7. 页面内容快照

- 未采集到页面内容快照。
