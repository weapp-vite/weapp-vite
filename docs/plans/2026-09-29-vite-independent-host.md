# 独立分包三入口编译对齐

## 范围

普通 Vite 与 Vite+ 的同一个 `weapp()` 支持微信独立分包，复用独立 CLI 的配置、隔离子编译和原生发布。worker、微信插件双产物、lib、多平台、Web 与后续消费体验仍由 #1097 追踪，本阶段不是完整能力对齐的终点。

## 实现

- 子上下文直接消费 owner 已加载的配置、CLI 覆盖和配置依赖；保留旧 CLI 双配置合并结果，子构建不执行配置文件。
- 主宿主已经安装的用户插件不重复注册；隔离子构建复用这些插件，避免子包跳过用户转换。
- 子构建只返回内存产物并释放模块图；主发布阶段通过 Vite/Rolldown emit/write 写出，失败继续传播。
- 独立构建调度抽为 `runtime/buildPlugin/independentPlan.ts`；生产 watch 每轮重新规划，精确子依赖交给主 watcher，失败后仍可恢复。
- 生产 watch 依据本次 resolved config 决定动态入口，不让父配置的 watch 标记移除一次性子构建入口。删除独立分包通过原有输出所有权清理。
- stateful 快照携带子包依赖和源码根；`statefulHmr/independentSources.ts` 在宿主 watcher 上登记会话订阅，子包 Vue/JS 触发完整批次，不承诺独立子包 JS 状态保持。关闭仅移除订阅，不关闭宿主 watcher 或解除其他插件的监听。

现有 `buildPlugin/service.ts`、`statefulHmr/session.ts` 与 `useLoadEntry/index.ts` 超过 300 行；本次只连接既有生命周期，将新增的独立调度与监听所有权逻辑拆到单独模块，避免同时大范围改写成熟 HMR 链路。

- stateful 插件不继承内部子构建固定为 warn 的 logger，保留宿主日志语义；消费检查等待明确就绪信号后再编辑文件。

## 验证契约

- 原生 TS fixture：配置文件不可执行、用户插件作用于子包、模板和脚本更新、错误恢复、删除子包清理、classic/stateful 关闭。
- Vue fixture：`wevu-subpackage-placement` 主包、普通分包、独立分包共用同一套页面与 DOM/runtime 断言；独立 Vue 变更覆盖主模块图之外的更新。
- runtime 每个 suite 只启动一次 automator；分包沿用 `navigateTo`，保留真实 IDE 的 routeDone/webview 兼容边界。页面/AppID 不新增，复用现有真实配置，构建后额外检查各页面 JS/JSON/WXML。
- 发布包消费：`verify-vite-host-install.mjs <wv|vite|vite-plus> <headless|devtools> independent`，严格 peer 安装、配置执行次数、原生命令更新及共享 runtime。
- CI 新增三入口独立分包严格发布包/headless 矩阵。

## 当前验证状态

- 配置/插件/独立分包/入口生命周期定向 126 项通过；补充 CLI 覆盖用例后 independent builder 9 项通过。
- stateful 扩展回归首轮 326 项通过；补齐宿主 watcher mock 后剩余 44 项及监听所有权新用例通过（45 项）。最终宿主/stateful/独立分包 9 项通过。
- 包级 typecheck、公共类型、构建、ESLint、网站、共享 IDE 启动约束和 changeset 联动通过。
- 三入口严格发布包消费和同一 runtime fixture 的 headless 场景通过。原生插件 classic/watch/stateful 和独立 wv classic/stateful 模板更新与恢复均验证配置只执行一次。
- 三入口真实微信 IDE 分包导航/页面状态均通过，runtime error 为 0；wv 首次 automator HTTP 500，经 Computer Use 确认登录与服务端口并重启后通过，断言保持不变。
- 远端 CI 待 PR 创建后跟踪。
