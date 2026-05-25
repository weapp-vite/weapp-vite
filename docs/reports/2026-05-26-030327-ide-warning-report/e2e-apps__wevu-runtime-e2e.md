# IDE Warning/Error 项目报告：e2e-apps/wevu-runtime-e2e

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`0/4/4/0/0`
- 页面快照：`0`
- 总问题数：`4`
- 普通运行时日志：`4`
- type-uncompatible 命中数：`0`

## 2. 所有 Warning/Error

1. `2` 次：`[runtime/relaunch-session-close/warn] route=/pages/layouts/index attempt=1 reason=Timeout in raw reLaunch /pages/layouts/index after 30000ms`
   - 示例原始行：`[warn] [runtime:relaunch-session-close] route=/pages/layouts/index attempt=1 reason=Timeout in raw reLaunch /pages/layouts/index after 30000ms`

2. `1` 次：`[runtime/devtools-log/warn] connect bridge: [2026-05-26 03:04:51.622][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect bridge: [2026-05-26 03:04:51.622][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

3. `1` 次：`[runtime/devtools-log/warn] connect bridge: [2026-05-26 03:05:39.312][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect bridge: [2026-05-26 03:05:39.312][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

## 3. Type-Uncompatible 子集

- 未命中 `received type-uncompatible value`。

## 4. Build Stats 样本

- 未采集到 build stats。

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=0 error=0 exception=0 total=0`
2. `log=0 info=0 warn=0 error=0 exception=0 total=0`
3. `log=0 info=0 warn=0 error=0 exception=0 total=0`
4. `log=0 info=0 warn=0 error=0 exception=0 total=0`

## 6. 普通 Runtime Logs

1. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:52368`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:52368`

2. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:53324`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:53324`

3. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:54008`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:54008`

4. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:54691`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:54691`

## 7. 页面内容快照

- 未采集到页面内容快照。
