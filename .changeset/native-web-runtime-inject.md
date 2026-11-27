---
"weapp-vite": minor
"@wevu/web-apis": patch
"create-weapp-vite": patch
---

feat(weapp-vite): 新增 `weapp.appPrelude.mode: 'native'`，显式选择后以 Rolldown 原生 `transform.inject` 为 Web Runtime 建立模块级精确绑定。自由标识符与 `globalThis.<target>` 等全局对象点号访问只导入真实使用的实现，不写入全局对象（按需导入、可 tree-shake）；`globalThis['<target>']` 等字符串计算属性、全局解构与别名按目标生成幂等桥接（目标缺失或带安装器占位标记时写入，真实宿主实现保留），判定与安装器共用同一个运行时函数；`globalTargets` 同时接受依赖展开目标（`URL`、`URLSearchParams`、`Blob`、`File`、`FormData`），用于精确补充无法静态推断的隐藏访问，独立于 `targets` 绑定资格（收窄 `targets` 不裁剪声明目标），安装声明目标及其必要依赖闭包，由根入口（含各分包根）静态依赖桥接在启动期安装。自定义 App Prelude 同样参与自由标识符与点号全局访问精确绑定，且根入口先求值 `globalTargets` 桥接、再运行 prelude，保证动态全局读取在启动时已就绪。native 行为固定为精确最优解，不再读取依赖包名、不提供策略开关、不生成 installer/eager 状态，也不包含 axios 专用环境模块或 bundle patch；用户只用 `targets` 选择作用域、`globalTargets` 精确补充隐藏访问，不全量安装未用实现。绑定、桥接与实现的分包交给打包器自然分组；自定义 App Prelude 作为普通静态模块执行，仅保留一条把它拆成独立 vendor（`weapp-vendors/web-runtime-app-prelude.js`）的分组规则。新增纯 runtime 入口 `@wevu/web-apis/runtime` 与 `weapp-vite/web-apis/runtime`，旧 installers 子路径继续服务既有整体安装 API。原有 `inline`、`entry`、`require` 模式及其默认 `require` 行为保持不变。
