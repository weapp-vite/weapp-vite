# 配置概览 {#config-overview}

`weapp-vite` 的配置写法和 Vite 一样：你仍然写 `vite.config.ts`，只是在里面多了一个 `weapp` 字段，用来放“小程序专属”的配置。为了更好查阅，文档把这些配置按主题拆成了多页，每页都配了常见场景和可直接复制的示例。

```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  // … 这里仍然可以写任意 Vite 配置
  weapp: {
    // weapp-vite 专属配置写在这里
  },
})
```

> [!TIP]
> 你也可以额外创建 `weapp-vite.config.ts`（或 `.mts/.cts/.js/.mjs/.cjs`）。weapp-vite 会先读取其中的 `weapp` 配置，再和 `vite.config.*` 合并，方便把“小程序配置”和“通用 Vite 配置”分开维护。

## 立刻上手

按下面 3 步检查，基本就能把配置方向找对：

1. **先确认 `app.json` 在哪里**：如果不在仓库根目录（例如在 `miniprogram/` 或 `src/`），优先配置 [`weapp.srcRoot`](./paths.md#weapp-srcroot)。
2. **再挑你需要的能力**：例如分包、npm、Worker、自动导入组件等，直接从下方“配置索引”跳转。
3. **最后照着示例改**：每页都按“什么时候用 → 怎么配 → 常见问题”组织，复制后改路径/规则即可。

## 配置索引

| 主题 | 内容概览 |
| --- | --- |
| [基础目录与资源收集](./paths.md) | `srcRoot` / `pluginRoot` / 静态资源拷贝 / 额外模板 |
| [构建输出与兼容](./build-and-output.md) | CommonJS / ESM 切换、`weapp.jsFormat`、`weapp.es5` 降级策略 |
| [JSON 配置](./json.md) | `jsonAlias` / JSONC 别名与引用 |
| [JS 配置](./js.md) | `tsconfigPaths` / 别名扩展 / Vite 配置协同 |
| [Vue SFC 配置](./vue.md) | `weapp.vue` 模板编译、scoped slot 策略 |
| [分包配置](./subpackages.md) | 独立/普通分包、依赖裁剪、共享样式 |
| [Worker 配置](./worker.md) | Worker 入口、构建产物、调试建议 |
| [生成脚手架配置](./generate.md) | `weapp.generate` 目录结构、后缀与模板定制 |
| [npm 配置](./npm.md) | 自动/手动构建、`weapp.npm` 字段、缓存与优化 |
| [WXML 配置](./wxml.md) | `weapp.wxml` 选项、额外模板收集、调优建议 |
| [WXS 配置](./wxs.md) | `weapp.wxs` 开关、调试方法、常见问题 |
| [自动导入组件配置](./auto-import-components.md) | `weapp.autoImportComponents` 字段、扫描规则与产物输出 |
| [共享配置](./shared.md) | 自动路由、调试钩子、HMR 与共享 chunk 策略 |
| [Web 运行时配置](./web.md) | `weapp.web` 浏览器端预览与调试 |
| [wevu 运行时默认值](./shared.md#weapp-wevu-defaults) | `weapp.wevu.defaults`：统一设置 `createApp/defineComponent` 默认值 |

> 仍在寻找 Vite 原生配置？可以直接参考 [Vite 官方配置文档](https://cn.vitejs.dev/config/)。

---

接下来按照你的项目需求选择对应页面进行配置。若你不确定该在哪一步调整，建议从 **基础目录与资源收集** 开始阅读。
