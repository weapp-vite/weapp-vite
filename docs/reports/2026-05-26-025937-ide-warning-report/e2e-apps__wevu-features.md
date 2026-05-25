# IDE Warning/Error 项目报告：e2e-apps/wevu-features

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`10/6/9/0/0`
- 页面快照：`0`
- 总问题数：`9`
- 普通运行时日志：`16`
- type-uncompatible 命中数：`0`

## 2. 所有 Warning/Error

1. `3` 次：`[runtime/launch-recover/warn] cleanup-devtools`
   - 示例原始行：`[warn] [runtime:launch-recover] cleanup-devtools`

2. `1` 次：`[runtime/launch-retry/warn] attempt=3/4 delay=1200ms reason=Timeout in read current page for route /pages/index/index after 12000ms`
   - 示例原始行：`[warn] [runtime:launch-retry] attempt=3/4 delay=1200ms reason=Timeout in read current page for route /pages/index/index after 12000ms`

3. `1` 次：`[runtime/launch-recover/warn] clean=all`
   - 示例原始行：`[warn] [runtime:launch-recover] clean=all`

4. `1` 次：`[runtime/launch-recover/warn] clean=compile`
   - 示例原始行：`[warn] [runtime:launch-recover] clean=compile`

5. `1` 次：`[runtime/devtools-log/warn] connect bridge: [2026-05-26 02:59:47.204][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect bridge: [2026-05-26 02:59:47.204][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

6. `1` 次：`[runtime/devtools-log/warn] connect bridge: [2026-05-26 03:00:14.976][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect bridge: [2026-05-26 03:00:14.976][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

7. `1` 次：`[runtime/devtools-log/warn] connect bridge: [2026-05-26 03:00:42.703][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect bridge: [2026-05-26 03:00:42.703][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

## 3. Type-Uncompatible 子集

- 未命中 `received type-uncompatible value`。

## 4. Build Stats 样本

1. `ide:wevu-features` -> warn=0 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=0 error=0 exception=0 total=0`
2. `log=0 info=0 warn=0 error=0 exception=0 total=0`
3. `log=0 info=0 warn=0 error=0 exception=0 total=0`
4. `log=10 info=0 warn=0 error=0 exception=0 total=0`

## 6. 普通 Runtime Logs

1. `1` 次：`[runtime/runtime/log] [router-coverage] afterEach {"from":"/","failureType":4,"failureMessage":"Forward navigation is not supported in mini-program router"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] afterEach {"from":"/","failureType":4,"failureMessage":"Forward navigation is not supported in mini-program router"}`

2. `1` 次：`[runtime/runtime/log] [router-coverage] afterEach {"to":"/pages/router-showcase/index#hash-only","from":"/"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] afterEach {"to":"/pages/router-showcase/index#hash-only","from":"/"}`

3. `1` 次：`[runtime/runtime/log] [router-coverage] afterEach {"to":"/router-guard/block","from":"/","failureType":4,"failureMessage":"Navigation aborted by guard"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] afterEach {"to":"/router-guard/block","from":"/","failureType":4,"failureMessage":"Navigation aborted by guard"}`

4. `1` 次：`[runtime/runtime/log] [router-coverage] afterEach {"to":"/router-guard/error","from":"/","failureType":4,"failureMessage":"guard-fail-intentional"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] afterEach {"to":"/router-guard/error","from":"/","failureType":4,"failureMessage":"guard-fail-intentional"}`

5. `1` 次：`[runtime/runtime/log] [router-coverage] beforeEach {"to":"/pages/router-showcase/index#hash-only","from":"/"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] beforeEach {"to":"/pages/router-showcase/index#hash-only","from":"/"}`

6. `1` 次：`[runtime/runtime/log] [router-coverage] beforeEach {"to":"/router-guard/block","from":"/"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] beforeEach {"to":"/router-guard/block","from":"/"}`

7. `1` 次：`[runtime/runtime/log] [router-coverage] beforeEach {"to":"/router-guard/error","from":"/"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] beforeEach {"to":"/router-guard/error","from":"/"}`

8. `1` 次：`[runtime/runtime/log] [router-coverage] beforeResolve {"to":"/pages/router-showcase/index#hash-only","from":"/"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] beforeResolve {"to":"/pages/router-showcase/index#hash-only","from":"/"}`

9. `1` 次：`[runtime/runtime/log] [router-coverage] beforeResolve {"to":"/router-guard/error","from":"/"}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] beforeResolve {"to":"/router-guard/error","from":"/"}`

10. `1` 次：`[runtime/runtime/log] [router-coverage] onError {"error":"guard-fail-intentional","mode":"push","to":"/router-guard/error","from":"/","failureType":4}`
   - 示例原始行：`[log] [runtime:runtime] [router-coverage] onError {"error":"guard-fail-intentional","mode":"push","to":"/router-guard/error","from":"/","failureType":4}`

11. `1` 次：`[runtime/launch-recover/info] cleaned=all`
   - 示例原始行：`[info] [runtime:launch-recover] cleaned=all`

12. `1` 次：`[runtime/launch-recover/info] cleaned=compile`
   - 示例原始行：`[info] [runtime:launch-recover] cleaned=compile`

13. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:49472`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:49472`

14. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:49900`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:49900`

15. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:64958`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:64958`

16. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:65406`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:65406`

## 7. 页面内容快照

- 未采集到页面内容快照。
