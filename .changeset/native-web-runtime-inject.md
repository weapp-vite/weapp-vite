---
"weapp-vite": minor
"@wevu/web-apis": minor
"@weapp-core/shared": minor
"@weapp-core/constants": patch
"create-weapp-vite": patch
---

feat(weapp-vite): 新增 `weapp.appPrelude.mode: 'native'`，显式选择后以 Rolldown 原生 `transform.inject` 为 Web Runtime 建立模块级精确绑定。自由标识符与普通 `globalThis.<target>` 等全局对象点号访问只导入真实使用的实现，不写入全局对象（按需导入、可 tree-shake）；可选链点号，以及读取形式的 `globalThis['<target>']`、全局解构与别名按目标生成幂等桥接（目标缺失或带安装器占位标记时写入，真实宿主实现保留），写入/自增/删除全局目标不触发安装；`globalTargets` 同时接受依赖展开目标（`URL`、`URLSearchParams`、`Blob`、`File`、`FormData`），用于精确补充无法静态推断的隐藏访问，独立于 `targets` 绑定资格（收窄 `targets` 不裁剪声明目标），安装声明目标及其必要依赖闭包，由根入口（含各分包根）静态依赖桥接在启动期安装。自定义 App Prelude 同样参与自由标识符与点号全局访问精确绑定，且根入口先求值 `globalTargets` 桥接、再运行 prelude，保证动态全局读取在启动时已就绪。native 行为固定为精确最优解，不再读取依赖包名、不提供策略开关、不生成 installer/eager 状态，也不包含 axios 专用环境模块或 bundle patch；用户只用 `targets` 选择作用域、`globalTargets` 精确补充隐藏访问，不全量安装未用实现。绑定、桥接与实现的分包交给打包器自然分组；自定义 App Prelude 作为普通静态模块执行，仅保留一条把它拆成独立 vendor（`weapp-vendors/web-runtime-app-prelude.js`）的分组规则。新增纯 runtime 入口 `@wevu/web-apis/runtime` 与 `weapp-vite/web-apis/runtime`，旧 installers 子路径继续服务既有整体安装 API。原有 `inline`、`entry`、`require` 模式及其默认 `require` 行为保持不变。

native 桥接改用受保护的 `globalThis[key]` 读写，不依赖 `Reflect.get/set`；完整宿主实现优先保留，缺失、占位或上一轮 native 安装的值可替换，已知不完整能力按目标修补并保留构造器身份。写入后回读确认并用 `__wvRGN__` 标记 native 所有权，HMR 可替换自身旧实例而不覆盖真实宿主值。新增轻量入口 `@wevu/web-apis/runtime-global`、`runtime-ensure` 及对应 `weapp-vite/web-apis/*` 转发，按目标加载共享判定或能力修补，避免单目标桥接带入无关 Web API；`@weapp-core/shared/platforms/runtime/global-keys` 提供轻量平台全局键列表，完整平台描述符从同一组常量派生。更深的内置子路径单独登记别名并排在父入口之前，不再被 `.../platforms/runtime` 之类父入口的字符串别名截获；内置别名保持字符串形状，用户自定义别名的前缀语义不变。
