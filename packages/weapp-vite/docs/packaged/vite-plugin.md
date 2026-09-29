# 标准 Vite 插件与 Vite+

`weapp-vite/vite` 提供实验性的生产构建入口。当前阶段支持单目标微信原生 JS/TS、Wevu Vue SFC、自动路由、自动组件和普通分包。主产物由宿主 Vite 的编译管线生成。

## 配置

项目使用 ESM（`package.json` 设置 `"type": "module"`），或将配置命名为 `vite.config.mts`：

```ts
import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'

export default defineConfig({
  plugins: [weapp()],
  weapp: {
    platform: 'weapp',
    srcRoot: 'src',
  },
})
```

插件没有第二套配置参数。配置文件由宿主加载，插件不会自动发现或合并另一份 `weapp-vite.config.*`。迁移时把配置收敛到一个入口；需要拆文件时，在该入口显式导入。不要重复调用 `weapp()`，也不要把同一插件实例共享给两个活动宿主。

```sh
vite build
```

`mode: 'test'` 仍可用于生产构建。测试识别依赖实际 Vitest 宿主标识，不根据 mode 猜测。只读取配置不会扫描小程序入口、生成支持文件或启动 IDE/MCP；`wv prepare` 继续负责类型支持文件。

## Vite+

配置中的 `defineConfig` 改为从 `vite-plus` 导入，然后使用 `vp build`。Vite+ 消费项目须按官方迁移规则把 `vite` 指向配套 core，并确保 weapp-vite 的依赖也解析到同一宿主。例如 npm 项目：

```json
{
  "type": "module",
  "devDependencies": {
    "vite-plus": "1.0.0",
    "vite": "npm:@voidzero-dev/vite-plus-core@1.0.0"
  },
  "overrides": {
    "vite": "$vite"
  }
}
```

pnpm 使用项目级 `pnpm-workspace.yaml` 的 `overrides` 完成同样的 alias；不要只修改顶层依赖而留下 weapp-vite 内嵌的另一套 Vite。该组合对应 Vite 8.3.1 / Rolldown 1.2.11；Vite+ 项目验证线为 Node 24.11+，普通 weapp-vite 的 Node 范围不变。

## 当前命令边界

| 命令 | 当前行为 |
| --- | --- |
| `vite build` / `vp build` | 实验性微信生产构建 |
| `wv dev` / `wv build` | 保留原有能力；显式插件不会重复安装编译器 |
| `vite dev` / `vp dev` | 尚未开放，实际启动时报出使用 `wv dev` 的提示 |
| `build --watch` | 尚未开放，构建前报错 |
| `vp test` | 插件不启动小程序编译；mpcore 测试继续显式使用 artifact API |
| `wv prepare/open/upload/mcp` | 继续使用小程序专属命令 |
| `vp preview` | Vite 的 Web 预览，不是小程序二维码预览 |
| `vp pack` | 通用库打包，不替代小程序 lib mode |

React、独立分包、worker、微信插件双产物、lib mode、多平台与 Web 混合宿主未开放。遇到这些目标应使用现有 `wv` 链路，不通过生成部分产物来跳过限制。

生产构建和一次性测试优先；classic dev、stateful HMR、任务缓存、Dashboard/MCP 会话复用、脚手架工具链选项和完整跨平台发布矩阵仍属于后续阶段。尤其不能把 bundled-development 能力探针通过等同于 stateful runtime 已通过。

## 检查与排障

- 缺少入口：核对 `weapp.srcRoot`、`app.json`/`app.vue` 和宿主的 `root`。
- ESM 配置加载失败：使用 `type: module` 或 `.mts`，不依赖旧 CLI 的 runner 回退。
- 引擎加载失败：核对 Vite+ core alias 和实际解析路径；配套引擎缺失时会报错，不静默切换到其他 Rolldown。
- 类型检查：继续使用 `wv prepare`、`vue-tsc`/`tsc`、ESLint 与 stylelint；`vp check` 不能替代全部小程序规则。
- 缓存：开发服务、IDE、上传、MCP 与 runtime E2E 不应配置任务缓存。生产缓存的完整恢复与输入失效矩阵尚未验收。

跟踪：[标准插件与 Vite+ 集成 #1097](https://github.com/weapp-vite/weapp-vite/issues/1097)。
