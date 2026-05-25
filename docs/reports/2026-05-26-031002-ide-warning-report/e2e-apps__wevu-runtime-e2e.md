# IDE Warning/Error 项目报告：e2e-apps/wevu-runtime-e2e

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`0/12/0/0/0`
- 页面快照：`0`
- 总问题数：`0`
- 普通运行时日志：`12`
- type-uncompatible 命中数：`0`

## 2. 所有 Warning/Error

- 未采集到 warning/error/exception。

## 3. Type-Uncompatible 子集

- 未命中 `received type-uncompatible value`。

## 4. Build Stats 样本

1. `wevu-runtime:weapp:esm` -> warn=0 error=0 exit=0
2. `wevu-runtime:weapp:cjs` -> warn=0 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=5 warn=0 error=0 exception=0 total=0`
2. `log=0 info=5 warn=0 error=0 exception=0 total=0`

## 6. 普通 Runtime Logs

1. `4` 次：`[runtime/runtime/info] [runtime-scroll-debug] scrollTop=1200`
   - 示例原始行：`[info] [runtime:runtime] [runtime-scroll-debug] scrollTop=1200`

2. `4` 次：`[runtime/runtime/info] [runtime-scroll-debug] scrollTop=1800`
   - 示例原始行：`[info] [runtime:runtime] [runtime-scroll-debug] scrollTop=1800`

3. `2` 次：`[runtime/runtime/info] [runtime-scroll-debug] scrollTop=10`
   - 示例原始行：`[info] [runtime:runtime] [runtime-scroll-debug] scrollTop=10`

4. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:58173`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:58173`

5. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:58718`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:58718`

## 7. 页面内容快照

- 未采集到页面内容快照。
