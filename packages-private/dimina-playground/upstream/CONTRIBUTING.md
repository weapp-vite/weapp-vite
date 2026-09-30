# 向 Dimina 提交兼容补丁的准备材料

本目录是可供审阅的贡献材料，尚未向上游发布 issue 或 PR。基线是 `didi/dimina@fa34f11e02f480df715d374e11a3f531f63b7a60`。补丁不包含 weapp-vite 代码或生成 bundle；真实 compiler/service/render 的最小回归由临时小程序驱动，可独立在 Dimina 源码树运行。

## 建议上游 PR 标题

`feat: 支持组件泛型与 virtualHost，并同步动态根节点生命周期`

## 问题与实现

固定提交未保留组件泛型声明，默认实现也没有进入编译依赖图。实例绑定需要使用声明上下文，转发时保留已经解析的实现路径。事件则由出口声明者处理。补丁将声明和默认依赖纳入 compiler，render 按实例保存组件解析表，避免同一个组件的两个实例复用错误绑定。

`options.virtualHost` 由 service 的组件元数据传到 render；渲染时展开编译器生成的 ComponentHost 为 Fragment。普通组件继续生成宿主。补丁不在挂载后删除 DOM。

动态根节点最小复现：virtualHost 组件初次渲染为空，通过 setData 依次变成双根、单根、空根、双根。仅在 onMounted 注册根节点会遗漏后来出现的节点，消失的根也未注销。修复在挂载和更新时同步当前根集合，卸载时清理最后注册的集合。回归同时检查模块注册、样式宿主 token、普通组件宿主、属性更新、事件归属和 service/render 清理。

## 独立验证

在此仓库可直接运行：

```sh
pnpm --filter @weapp-vite/dimina-playground setup:dimina
pnpm --filter @weapp-vite/dimina-playground test:upstream
```

在独立 Dimina clone 中：

1. checkout 上述固定提交；工作区需干净。
2. 将本目录的 `pnpm-lock.yaml` 复制到上游 `fe/pnpm-lock.yaml`。该提交没有随仓库提供锁文件，本目录记录的是 pnpm 12.2.0 的冻结锁。
3. clone 的源码与补丁均需使用 LF（Windows 设置该 clone 的 `core.autocrlf=false` 后重新 checkout）；在 clone 根目录运行 `git apply --check <component-semantics.patch>`，然后 `git apply <component-semantics.patch>`。尖括号内容替换为补丁实际路径。
4. 使用 Node ≥22.22.3 和已完成安装脚本的 pnpm 12.2.0（可先通过本实验 setup 准备隔离工具链），在 `fe` 运行 `pnpm install --frozen-lockfile`，再运行 `pnpm --filter @dimina/compiler --filter '@dimina/fe-container-sdk^...' build`。
5. 在 `fe/packages/render` 运行：

```sh
pnpm exec vitest run __tests__/component-generics.spec.js __tests__/virtual-host-metadata.spec.js __tests__/real-component-lifecycle.spec.js
```

当前共 7 项：泛型与动态根场景分别从空根/有根初始化，另有元数据及既有生命周期回归。测试使用临时目录和真实编译器，既不依赖 weapp-vite fixture，也不依赖在线容器服务。

对照复现：保留新增测试，撤销 `runtime.js` 中 `syncModuleRoots` 的更新同步，空根转双根后的 `moduleRootIds` 断言失败；仅保留挂载注册时，后来移除的根同样无法满足清理断言。不要以改断言或跳过替代修复。

## 维护与边界

源码补丁集中放在 `patches/component-semantics.patch`，修改后必须重新 setup。准备摘要同时包含上游提交、冻结锁、准备逻辑和补丁。源码缓存中的未知修改不会被覆盖。

上游 `runtime.js` 已超过 300 行；此次沿用现有组件创建/生命周期位置，避免在固定提交补丁中加入大规模无关重构。独立回归文件不足 300 行。后续上游合入时可讨论将组件实例创建逻辑单独抽离。

Web 三类真实产物与分包加载另由 `pnpm e2e:dimina` 验证。原生 Android/iOS/鸿蒙未验收；完整微信样式隔离、relations、所有泛型/插槽组合、所有容器 API 也不在本补丁已证明范围。Vue 针对 Fragment 上 runtime directive 的警告仍需上游另行评估，不将本次有限覆盖表述为完整兼容。
