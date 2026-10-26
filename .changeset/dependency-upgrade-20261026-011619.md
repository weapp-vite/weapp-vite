---
'@mpcore/core': patch
'@mpcore/simulator': minor
'@mpcore/test': minor
'@mpcore/vitest': minor
'@mpcore/weapp-vite': minor
'@weapp-agent/cli': minor
'@weapp-core/api': minor
'@weapp-core/constants': minor
'@weapp-core/init': minor
'@weapp-core/logger': minor
'@weapp-core/schematics': minor
'@weapp-core/shared': minor
'@weapp-core/types': minor
'@weapp-vite/acceptance': minor
'@weapp-vite/ast': minor
'@weapp-vite/ast-native': minor
'@weapp-vite/dashboard': minor
'@weapp-vite/devtools-runtime': minor
'@weapp-vite/eslint': minor
'@weapp-vite/glass-easel-web-adapter': patch
'@weapp-vite/hmr': minor
'@weapp-vite/i18n': minor
'@weapp-vite/mcp': minor
'@weapp-vite/miniprogram-automator': minor
'@weapp-vite/qr': minor
'@weapp-vite/react': minor
'@weapp-vite/tailwindcss': minor
'@weapp-vite/volar': minor
'@weapp-vite/web': minor
'@wevu/api': minor
'@wevu/compiler': minor
'@wevu/json-render': minor
'@wevu/json-render-components': minor
'@wevu/query': minor
'@wevu/test-utils': minor
'@wevu/web-apis': minor
'create-weapp-vite': minor
'rolldown-require': minor
'vite-plugin-performance': minor
'weapp-ide-cli': minor
'weapp-vite': minor
'wevu': minor
---

chore(deps)!: 升级构建、运行与发布工具链，并提高 Node.js 最低版本。

Node.js 支持范围调整为 `^22.23.4 || ^24.22.1 || >=26.12.1`；生成项目同步使用此范围。Vite+ 保持仅支持 Node 24/26 的原有边界。

Bun 使用独立运行时身份，CLI 与 Tailwind 插件不再将其 Node 兼容标识误判为不支持的真实 Node 版本；真实 Node 最低版本检查保持。

公开构建队列升级至 p-queue 10：监听改用 EventTarget 的 `addEventListener` / `removeEventListener`，事件值通过 `event.detail` 获取；清空队列会以 AbortError 拒绝尚未执行的任务。

截图比较升级至 pixelmatch 8 的 OKLab/HyAB 算法，同一阈值可能产生不同的差异结果；保留现有阈值并重新复核基线。

Chokidar 6 自有监听器通过 `build.watch.chokidar` 配置 `backend`、`pollingInterval`、`pollingBinaryInterval`，兼容旧 polling 别名；`server.watch` 保留 Vite 的配置边界，Rolldown 原生监听选项使用 `build.watch.watcher`。

Web 路由发布按完整扫描快照登记回执，避免目录重命名分批通知导致重复 reload；旧宿主在途加载与 HMR 不会消费新宿主回执。Wot UI 2.4.0 的宽屏裁剪器白屏修复已复核并定向迁移桌面视觉基线。

合并 catalog、模板及各发布包依赖升级 intent，TypeScript 编译器版本保持不变。本轮按维护者确认的发布策略，将 Node 下限及公开行为变化涉及的 40 个包统一记录为 minor，其余两个包保留 patch。这是接受上述迁移要求的发布例外，不代表完全向后兼容；保留破坏性变更标记及迁移说明。具体版本和迁移步骤见 `docs/plans/2026-10-26-dependency-upgrade.md`。
