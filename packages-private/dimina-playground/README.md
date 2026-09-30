# Dimina 接入实验

关联 [weapp-vite issue #1101](https://github.com/weapp-vite/weapp-vite/issues/1101)。这是私有验证工作区，不提供公开 `platform` 配置，也不替换现有 Web runtime 或 mpcore。

## 准备

需要 Node.js ≥22.22.3、仓库配置的 pnpm、Git 和 Playwright Chromium。所有命令从仓库根目录运行。

```sh
pnpm install
pnpm --filter 'weapp-vite...' --filter '@weapp-vite/react...' build
pnpm --filter @weapp-vite/dimina-playground setup:dimina
pnpm exec playwright install chromium
```

上游固定为 `didi/dimina@fa34f11e02f480df715d374e11a3f531f63b7a60`，许可证为 Apache-2.0。源码保存在已忽略的 `.cache/dimina/source` 中，不提交 vendor 源码或生成 bundle。当前 npm 上没有可安装的 `@dimina/fe-container-sdk`，因此 setup 从源码构建 compiler、SDK 和依赖。

该上游提交没有提供 pnpm 锁文件；`upstream/pnpm-lock.yaml` 是针对固定提交、pnpm 12.2.0 生成的完整依赖锁，setup 复制后使用 `--frozen-lockfile` 安装。上游源码缓存存在已跟踪或未跟踪修改时拒绝覆盖。setup 是显式操作，不在仓库安装钩子中执行。默认 build、dev、CI、release 与 Windows 构建入口均排除此实验包；仍可用上面的工作区命令显式准备和运行。

上游 SDK 的 Vite 库构建会保留 Vue 的 `process.env.NODE_ENV`；setup 通过 Vite `define` 固定生产环境及 Vue feature flags，避免浏览器依赖 Node 全局对象。

## 运行

```sh
pnpm --filter @weapp-vite/dimina-playground dev
pnpm --filter @weapp-vite/dimina-playground build
pnpm --filter @weapp-vite/dimina-playground preview
```

使用命令输出的 `/dimina/` 地址。页面提供原生、wevu、React 三个入口，均由本地实际构建产物加载，不请求在线演示。

构建分为三步：

1. 使用 `createCompilerContext` 程序化构建入口，通过 Vite/Rolldown 生成完整微信格式产物。
2. DMCC 在独立的 `.cache` 中间目录编译；读取项目元数据、npm 组件、分包与资源，完成后清理中间目录。
3. 宿主 Vite 插件通过 `emitFile` 输出所有资源，包括独立 SDK、Worker、CSS 和 pageFrame。SDK 不经过宿主二次打包，`mitt` 通过 import map 解析，Worker 保留相对 URL。

`dev` 合并并串行处理 fixture 修改。只有全部编译成功才替换内存中的资源并整体重载；失败显示错误并继续提供上次成功结果。首期不提供状态保持 HMR。宿主分别记录启动与构建状态，异步 openApp 成功不会覆盖先到达的构建错误；成功重建通过整页重载清除错误。

每次 DMCC 编译使用独立子进程，并设置上游支持的 `ASSETS_PATH_PREFIX=1`，使图片地址相对于 SDK 的 `resourceBaseUrl` 解析，避免落到站点根目录。`openApp` 显式传入首屏路径。微信产物使用每轮新建的目录，关闭重复清空，避免与 npm 组件准备互相覆盖。

## 验证

```sh
pnpm --filter @weapp-vite/dimina-playground lint
pnpm --filter @weapp-vite/dimina-playground typecheck
pnpm --filter @weapp-vite/dimina-playground test
pnpm --filter @weapp-vite/dimina-playground build
pnpm e2e:dimina
```

E2E 通过仓库 suite runner 显式运行，必须与其他仓库 E2E 串行。浏览器缺失、依赖准备失败或启动失败均会报错，不跳过。浏览器使用独立上下文，服务与浏览器在结束时清理。类型检查覆盖接入工具、宿主和 E2E；fixture 的可执行语义由真实编译和浏览器测试验证。

覆盖开发服务和生产预览，默认使用非根 `/dimina/` 路径：

- 原生：setData、WXS、原生组件事件、Vant npm 组件、静态图片、分包返回和状态保留。
- wevu：响应式、v-model、具名/作用域插槽、virtualHost 组件。
- React：静态 bridge 页面、组件事件、独立动态列表页面。
- 宿主：扩展 Bridge 成功与失败、配置资源 404、开发重建失败及恢复。

React 原生组件 bridge 当前只支持可静态分析的页面结构，动态列表单独放在另一页面，遵循现有 React compiler 契约。

## 补丁与实测支持范围

固定提交缺少泛型与 virtualHost 支持。本实验在 `upstream/patches/component-semantics.patch` 维护源码补丁，不直接修改最终 bundle，也不依赖在线演示资源。

- compiler 保留 `componentGenerics` 元数据，并将默认组件加入依赖图；泛型出口使用正常组件渲染路径。
- render 根据声明上下文解析绑定，按实例保存组件表，在 Vue 安装静态选项后恢复实例表；嵌套转发复用已经解析的绑定。泛型实现的事件仍交回出口声明者，保持属性更新与组件生命周期。
- service 传递实际 `options.virtualHost`；render 在创建 VNode 时展开编译器宿主，不生成额外宿主 DOM，不在挂载后删除节点。普通组件仍保留宿主。

setup 每次从干净的固定源码创建独立 `.cache/dimina/build-*` 目录，先 `git apply --check`，再应用补丁并使用冻结锁文件构建。构建中运行真实 compiler/service/render 回归与元数据测试（6 项），最后才写入就绪标记。标记包含上游提交以及锁文件、准备脚本和全部补丁的 SHA-256 摘要；修改输入后，显式构建会要求重新 setup。失败会移除标记，重跑会创建新目录恢复，不覆盖先前目录或未知本地修改。旧构建目录保留供排查，可在确认不再使用后手动清理。

新增浏览器默认组件场景还暴露了 weapp-vite 的独立缺口：只出现在 `componentGenerics.default` 中的组件没有进入入口和增量依赖图。这部分在公开编译器中统一收集依赖，附带构建入口单测、增量依赖移除回归和 `weapp-vite` / `create-weapp-vite` patch changeset；另修复并行构建失败时提前返回的问题：等待 npm、worker、项目配置写入结束后才把目录所有权交还调用方，避免临时目录清理后继续写入导致开发进程退出。未增加公开 API 或平台配置。

2026-09-30 在 macOS、Node.js 24.18.0、Playwright Chromium 上实测：

- 原有 15 项浏览器测试全部通过，新增 dev/preview 泛型边界各 1 项；`pnpm e2e:dimina` 为 **17/17 通过**，无跳过、预期失败或放宽断言。
- wevu 具名/作用域插槽、响应式属性更新和插槽事件回传通过；virtualHost 无额外宿主，scoped 样式生效。
- 原生泛型覆盖多实例不同绑定、默认组件、嵌套转发、事件归属、普通组件保留宿主，以及移除实例后的 detached 清理。
- 原生完整流程、React 状态/列表/组件事件、wevu `v-model`、Bridge 成功/失败、分包返回状态保留、图片、配置缺失、SDK 加载失败及开发重建失败恢复均通过。Worker、iframe 和资源在 `/dimina/` 下实际加载。
- setup 首次与重复准备、补丁/锁/脚本变更失效、补丁失败/构建失败后的恢复、未知修改保留均有验证；工作区工具测试 13 项、构建选择及 Windows planner 回归 20 项、公开依赖图定向单测 12 项及构建生命周期相关 96 项测试通过。
- lint、stylelint、工作区及 weapp-vite typecheck、实验生产构建通过。远端 CI 结果以草稿 PR #1104 的 checks 为准；本地结果不代表 Windows/Linux 矩阵或原生宿主验收。

最小复现：运行 `pnpm e2e:dimina`，或进入 wevu 示例检查具名/作用域插槽；原生首页的“泛型边界测试”提供多实例、默认组件、转发、事件与卸载观察入口。补丁内的 `component-generics.spec.js` 用上游真实编译器和 service/render bridge 构建独立临时小程序，可与上游实现对照。

浏览器运行日志保存在 suite runner 的 `docs/reports` 报告中；各交互场景的截图保存在已忽略的 `.cache/dimina/screenshots`。测试通过 iframe 中的真实画面、DOM 和交互观察结果，不假定宿主线程持有小程序 `wx`。

## 能力边界

Web 验证不能证明 Android、iOS 或鸿蒙兼容。原生宿主接入、动态包发布体系、HMR 状态保持、完整 sourcemap 串联和第三方组件库全量兼容均留待后续。

只有全部基础示例的浏览器断言通过才能宣称首期完成；上游不兼容必须保留具体场景，不通过跳过或弱化断言消除失败。
