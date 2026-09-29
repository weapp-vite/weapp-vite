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

该上游提交没有提供 pnpm 锁文件；`upstream/pnpm-lock.yaml` 是针对固定提交、pnpm 12.2.0 生成的完整依赖锁，setup 复制后使用 `--frozen-lockfile` 安装。上游源码缓存存在已跟踪修改时拒绝覆盖。setup 是显式操作，不在仓库安装钩子中执行。

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

`dev` 合并并串行处理 fixture 修改。只有全部编译成功才替换内存中的资源并整体重载；失败显示错误并继续提供上次成功结果。首期不提供状态保持 HMR。

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

## 当前兼容性阻塞

固定提交上的浏览器实测发现以下两个上游缺口，**尚未通过首期完整验收**。测试保留预期行为，不使用 skip、预期失败或放宽断言掩盖差异。

2026-09-29 在 macOS、Node.js 24.18.0、Playwright Chromium 上实测：

- setup 首次准备及再次 frozen 安装构建成功；lint（包括 fixture）、stylelint、typecheck、3 项工具单测、28 项 suite manifest 测试及生产构建通过。
- `pnpm e2e:dimina`：**11 通过、4 失败，共 15 项**，命令返回非零退出码；未使用 `--allow-failures`。
- 原生完整流程、React 状态/列表/组件事件、wevu 响应式与 `v-model`、Bridge、分包返回状态保留、图片、配置缺失、SDK 加载失败均在 dev 和 preview 通过。Worker、iframe 和资源在 `/dimina/` 下实际加载。
- dev 构建失败保留原页面、修正后重载以及恢复初始源码通过。
- 4 项失败是下表两项语义在 dev 和 preview 各失败一次。未执行 Windows/Linux 或 Android/iOS/鸿蒙运行验收。

| 场景 | 最小复现 | 当前行为与原因 |
| --- | --- | --- |
| 具名及作用域插槽 | `fixtures/wevu/src/pages/index/index.vue` 与 `components/slot-probe/index.vue` | wevu 输出 `componentGenerics`、`generic:scoped-slots-*`；DMCC 未读取泛型声明，泛型出口变成普通未知 HTML 元素，插槽内容未渲染。 |
| `virtualHost` | 同一 SlotProbe 的 `defineOptions({ options: { virtualHost: true } })` | DMCC `core/view-compiler.js` 为组件无条件生成 `component-host`，render 仍保留带 `data-dd-component-host` 的额外宿主节点。 |

不在适配层把泛型实例硬编码成某个示例组件，也不在宿主 DOM 中删除节点：这些能力需要上游编译器、服务层和渲染层共同支持。当前没有修改锁定的上游源码；后续应在 Dimina 补齐语义后更新固定提交，重跑同一验收。

复现命令：`pnpm e2e:dimina`，或运行 `pnpm --filter @weapp-vite/dimina-playground dev` 后选择 wevu。点击加一、输入文字可以工作，但具名/作用域插槽缺失。用浏览器检查 `.slot-probe` 的父节点可观察到额外组件宿主。

浏览器运行日志保存在 suite runner 的 `docs/reports` 报告中；各交互场景的截图保存在已忽略的 `.cache/dimina/screenshots`。测试通过 iframe 中的真实画面、DOM 和交互观察结果，不假定宿主线程持有小程序 `wx`。

## 能力边界

Web 验证不能证明 Android、iOS 或鸿蒙兼容。原生宿主接入、动态包发布体系、HMR 状态保持、完整 sourcemap 串联和第三方组件库全量兼容均留待后续。

只有全部基础示例的浏览器断言通过才能宣称首期完成；上游不兼容必须保留具体场景，不通过跳过或弱化断言消除失败。
