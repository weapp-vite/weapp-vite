# React 验证矩阵

| 层级 | 覆盖目标 | 消费项目入口 |
| --- | --- | --- |
| 依赖与类型 | runtime peer dependencies、公开 API、root 与事件类型 | 读取项目 `package.json` 和已安装包类型；运行已有 typecheck script |
| 项目相关测试 | Hooks 更新、事件 payload、序列化、每实例 root 生命周期 | 运行项目已存在的对应测试 script；没有测试时明确覆盖缺口，不调用框架源码测试 |
| 目标构建 | TSX 转换、WXML/JSON、bridge 注册、Compiler warning | 项目已有 build script；已安装 `weapp-vite` 且无脚本时可用 `pnpm exec wv build -p weapp` |
| 微信 runtime | Hooks、事件、插槽、原生/Wevu bridge、返回栈与卸载 | 项目自己的微信 IDE/真机页面与交互；不要求仓库 E2E harness |

验证时遵循：

- 仅 `@weapp-vite/react` 可用时，可检查公开 runtime API 与项目已有适配器/产物；涉及 TSX 编译、`weapp.react` 或 `wv` 时，先确认项目显式安装 `weapp-vite`。Wevu SFC bridge 另需 `wevu`。
- 在真实页面修改状态并触发组件事件，检查实际文本、`event.detail`、默认插槽和卸载后的 effect cleanup；同路由入栈两次再返回时，确认各实例 root 不互相覆盖或销毁。
- 先断言公开 API、稳定产物路径、可见文本和事件结果，不匹配压缩变量名或 chunk hash。构建通过、snapshot 或 `setData` 调用成功都不证明可见视图已更新。
- 使用消费项目自己的 IDE/自动化流程，只释放本任务明确拥有的连接、watcher 和页面；不清理用户或其他任务资源。
- Compiler 仅在显式启用时检查 warning、sourcemap 和实际行为。上传、发布、框架维护命令都不是默认验证步骤。
- Web、支付宝或抖音构建成功不能作为 React runtime 兼容结论；目标 IDE/真机未运行时明确记录运行时验收未完成。
