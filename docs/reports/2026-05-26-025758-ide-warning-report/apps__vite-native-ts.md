# IDE Warning/Error 项目报告：apps/vite-native-ts

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`1/0`
- runtime log/info/warn/error/exception：`6/3/3/0/0`
- 页面快照：`0`
- 总问题数：`4`
- 普通运行时日志：`9`
- type-uncompatible 命中数：`0`

## 2. 所有 Warning/Error

1. `1` 次：`[runtime/launch-recover/warn] clean=compile`
   - 示例原始行：`[warn] [runtime:launch-recover] clean=compile`

2. `1` 次：`[runtime/launch-recover/warn] cleanup-devtools`
   - 示例原始行：`[warn] [runtime:launch-recover] cleanup-devtools`

3. `1` 次：`[runtime/devtools-log/warn] connect bridge: [2026-05-26 02:58:07.478][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`
   - 示例原始行：`[warn] [runtime:devtools-log] connect bridge: [2026-05-26 02:58:07.478][ERROR][unknow][/core.wxvpkg/aaf1281ae61d97fedb52fc70da3f8a2f.js] simulator launch catch error TypeError: Cannot read property 'subPackages' of undefined`

4. `1` 次：`[build/build/warn] transforming...[warn] 检测到本地组件 `miniprogram/components/navigation-bar/navigation-bar` 与微信内置组件 `navigation-bar` 重名。自动导入将优先使用本地组件，但这会遮蔽同名内置组件；建议参考 https://developers.weixin.qq.com/miniprogram/dev/component/ 后重新命名。`
   - 示例原始行：`[warn] [build:build] transforming...[warn] 检测到本地组件 `miniprogram/components/navigation-bar/navigation-bar` 与微信内置组件 `navigation-bar` 重名。自动导入将优先使用本地组件，但这会遮蔽同名内置组件；建议参考 https://developers.weixin.qq.com/miniprogram/dev/component/ 后重新命名。`

## 3. Type-Uncompatible 子集

- 未命中 `received type-uncompatible value`。

## 4. Build Stats 样本

1. `ide:vite-native-ts-worker` -> warn=1 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=0 error=0 exception=0 total=0`
2. `log=6 info=0 warn=0 error=0 exception=0 total=0`

## 6. 普通 Runtime Logs

1. `4` 次：`[runtime/runtime/log] {}`
   - 示例原始行：`[log] [runtime:runtime] {}`

2. `2` 次：`[runtime/runtime/log] Zsfw9GLu7dnR8tRr3BDk4kFnxIdc8veiKX2gK49LqOA=`
   - 示例原始行：`[log] [runtime:runtime] Zsfw9GLu7dnR8tRr3BDk4kFnxIdc8veiKX2gK49LqOA=`

3. `1` 次：`[runtime/launch-recover/info] cleaned=compile`
   - 示例原始行：`[info] [runtime:launch-recover] cleaned=compile`

4. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:63358`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:63358`

5. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:63793`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:63793`

## 7. 页面内容快照

- 未采集到页面内容快照。
