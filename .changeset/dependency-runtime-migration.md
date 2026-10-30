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

chore(deps)!: 升级工具链依赖，更新 Node.js 支持范围与升级提醒。

Node.js 官方支持范围为 `^22.23.4 || ^24.22.1 || >=26.12.1`，发布包与生成项目的 `engines.node` 使用此范围。Vite+ 仍使用 `^24.22.1 || >=26.12.1`。

`weapp-vite` 的 `build`、`dev`、`prepare`、`accept`、`mcp` 和 Tailwind 集成在范围外提示升级并继续运行。提醒通过 stderr 输出中文，按终端颜色设置突出当前版本和推荐范围，并提示“建议升级到受支持 LTS 分支的最新补丁版本，以获得安全修复”；Tailwind 每个插件实例只提醒一次。

依赖加载、构建和 CSS 入口错误仍按原有方式处理，`prepare` 保留既有容错行为；允许尝试运行不代表承诺兼容所有旧版本。Bun 按独立运行时识别，不因其 Node 兼容版本触发提醒。入门与随包文档同步说明这一行为。

修复仓库首次安装时，`wv prepare` 因日志依赖尚未构建而提前退出的问题。中文与颜色提示在 workspace 包尚无构建产物时也能正常加载；CLI 尚未构建时仍提示跳过支持文件预生成，不阻断安装。

此次升级还修复了 Web 路由目录重命名时的重复 reload，以及 Wot UI 2.4.0 宽屏裁剪器白屏问题。TypeScript 编译器版本保持不变。

升级时请检查以下迁移要求：

公开构建队列升级至 p-queue 10：事件监听改用 `addEventListener` / `removeEventListener`，事件值从 `event.detail` 读取；清空队列会以 `AbortError` 拒绝尚未执行的任务。

截图比较升级至 pixelmatch 8 的 OKLab/HyAB 算法：相同阈值可能得到不同差异结果，请保留现有阈值并重新复核截图基线。

Chokidar 6 自有监听器通过 `build.watch.chokidar` 配置 `backend`、`pollingInterval`、`pollingBinaryInterval`，兼容旧 polling 别名。`server.watch` 仍由 Vite 管理，Rolldown 原生监听选项使用 `build.watch.watcher`。

本轮依赖升级沿用已确认的发布例外，该条目覆盖 40 个 minor 和 2 个 patch，不代表完全向后兼容。具体依赖版本和迁移步骤见 `docs/plans/2026-10-26-dependency-upgrade.md`。
