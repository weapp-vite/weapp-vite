---
'@mpcore/core': patch
'@mpcore/simulator': major
'@mpcore/test': major
'@mpcore/vitest': major
'@mpcore/weapp-vite': major
'@weapp-agent/cli': major
'@weapp-core/api': major
'@weapp-core/constants': major
'@weapp-core/init': major
'@weapp-core/logger': major
'@weapp-core/schematics': major
'@weapp-core/shared': major
'@weapp-core/types': major
'@weapp-vite/acceptance': major
'@weapp-vite/ast': major
'@weapp-vite/ast-native': major
'@weapp-vite/dashboard': major
'@weapp-vite/devtools-runtime': major
'@weapp-vite/eslint': major
'@weapp-vite/glass-easel-web-adapter': patch
'@weapp-vite/hmr': major
'@weapp-vite/i18n': major
'@weapp-vite/mcp': major
'@weapp-vite/miniprogram-automator': major
'@weapp-vite/qr': major
'@weapp-vite/react': major
'@weapp-vite/tailwindcss': major
'@weapp-vite/volar': major
'@weapp-vite/web': major
'@wevu/api': major
'@wevu/compiler': major
'@wevu/json-render': major
'@wevu/json-render-components': major
'@wevu/query': major
'@wevu/test-utils': major
'@wevu/web-apis': major
'create-weapp-vite': major
'rolldown-require': major
'vite-plugin-performance': major
'weapp-ide-cli': major
'weapp-vite': major
'wevu': major
---

chore(deps)!: 升级构建、运行与发布工具链，并提高 Node.js 最低版本。

Node.js 支持范围调整为 `^22.23.4 || ^24.22.1 || >=26.12.1`；生成项目同步使用此范围。Vite+ 保持仅支持 Node 24/26 的原有边界。

Bun 使用独立运行时身份，CLI 与 Tailwind 插件不再将其 Node 兼容标识误判为不支持的真实 Node 版本；真实 Node 最低版本检查保持。

公开构建队列升级至 p-queue 10：监听改用 EventTarget 的 `addEventListener` / `removeEventListener`，事件值通过 `event.detail` 获取；清空队列会以 AbortError 拒绝尚未执行的任务。

截图比较升级至 pixelmatch 8 的 OKLab/HyAB 算法，同一阈值可能产生不同的差异结果；保留现有阈值并重新复核基线。

Chokidar 6 自有监听器通过 `build.watch.chokidar` 配置 `backend`、`pollingInterval`、`pollingBinaryInterval`，兼容旧 polling 别名；`server.watch` 保留 Vite 的配置边界，Rolldown 原生监听选项使用 `build.watch.watcher`。

Web 路由发布按完整扫描快照登记回执，避免目录重命名分批通知导致重复 reload；旧宿主在途加载与 HMR 不会消费新宿主回执。Wot UI 2.4.0 的宽屏裁剪器白屏修复已复核并定向迁移桌面视觉基线。

合并 catalog、模板及各发布包依赖升级 intent，TypeScript 编译器版本保持不变。Node 下限及公开行为变化记录 major，其余包记录 patch。具体版本和迁移步骤见 `docs/plans/2026-10-26-dependency-upgrade.md`。
