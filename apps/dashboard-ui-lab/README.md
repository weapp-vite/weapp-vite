# dashboard-ui-lab

`dashboard-ui-lab` 是专门用于本地验证 `@weapp-vite/dashboard` 的小程序项目。

它不是业务示例，也不进入 E2E 串行套件。常规 UI 命令读取真实构建的 analyze payload；Inspector 实验入口则通过明确标记的合成报告，复用真实 Dashboard 与 Devframe 连接来验证可控交互。

## 覆盖点

- 主包页面、普通分包、独立分包。
- 多页面、多样式文件、组件和静态资源。
- WeVu / Vue SFC 页面与组件，用于观察 dashboard 对 Vue runtime chunk、SFC 页面和 SFC 组件的分析结果。
- 跨包复用的 `src/shared/*` 模块，用于观察 duplicate module 与 module source 面板。
- `dev:ui` 实时模式，用于验证 dashboard 首页、分析页、活动流、设计 token 和主题切换。

## 常用命令

```bash
pnpm --filter dashboard-ui-lab dev:ui
```

```bash
pnpm --filter dashboard-ui-lab build:ui
```

```bash
pnpm --filter dashboard-ui-lab build
```

本仓库开发态下，`wv dev --ui` 会优先读取 `@weapp-vite/dashboard` 的源码入口；发布包安装场景则继续读取 dashboard 的 `dist/` 静态产物。

## Inspector 可控场景

```bash
pnpm --filter @weapp-vite/dashboard build
pnpm --filter dashboard-ui-lab dev:inspector
```

打开终端输出的 OTP magic link，进入“体积地图”，通过详情列表依次选择 `__main__` → `inspector.js` → `inspector/selected-module.ts`。在启动命令的终端输入场景名即可更新同一 Dashboard 会话：

| 命令 | 场景 |
| --- | --- |
| `baseline` / `reset` | 恢复基线报告和源码；不主动重置同一节点的前端折叠 / 未读状态 |
| `same` | 推送内容与生成时间完全相同的新报告对象 |
| `related` | 增加固定模块 `selected-module.ts` 的贡献与关联产物；首次增加动态引用 |
| `unrelated` | 只更新无关独立包的文件与模块 |
| `delete` | 从报告移除固定模块，保留 `inspector.js`，观察节点回退 |
| `long` | 增加长路径、96 个基础关联产物和 72 个额外模块；重复执行不累积 |
| `source-error` / `source-restore` | 删除 / 恢复固定模块的临时源码，触发真实文件读取错误 / 恢复 |
| `status` / `help` | 查看当前场景状态 / 命令说明 |
| `quit` / `exit` | 关闭本会话并清理临时目录；EOF、Ctrl+C 也会清理 |

建议先关闭“所在产物 · 跨包位置”，依次执行 `same`、`unrelated`、`related`：仅最后一次应出现“有更新”，打开分组后提示消失。切到其他节点再切回可建立新的未读基线；`reset` 只重置 fixture 数据。

该入口的项目名含 `Inspector fixture (synthetic report)`，不替换 `dev:ui` / `build:ui`，也不证明真实小程序构建或 runtime 行为。源码保存在本会话独立的系统临时目录；产物只保存在内存快照中，不写入 `dist`。更新仍使用现有 OTP、scoped RPC 和 revision 协议，没有浏览器可写控制端点。

服务端不注入慢读取。需要检查加载中与过期响应时，可在独立 QA 浏览器中延迟真实文件 RPC；这不是生产协议或 Dashboard UI 的功能。
