# 分层验证矩阵

## 包级

```sh
pnpm --filter @wevu/a2ui test
pnpm --filter @wevu/a2ui typecheck
pnpm --filter @wevu/a2ui test:types
pnpm --filter @wevu/a2ui build
```

覆盖四种状态消息、严格 envelope、批次单次提交、失败回滚、多绑定/多动作、嵌套槽位、generation、输入写回、事件幂等、动作串行、transport metadata、标准函数与 schema-only 错误、兼容层和幂等销毁。

修改 `packages-runtime/a2ui/src/**` 后，先重建该包再运行任何消费应用或 headless/IDE 检查。

## Hostless / 打包入口

从实际消费方公共入口打包，在禁用 `Function` / `eval` 的隔离上下文执行。确认：

- 未执行动态字符串代码，未引用浏览器专有内建。
- 宿主已有 `Object.hasOwn` / abort 内建时不被替换。
- 兼容层显式保留，未因无引用副作用导入被裁掉。
- `A2uiNode` 与动作消息保持可序列化结构。

## Headless 与真实 DevTools

至少覆盖主路径和一个关键边界：

1. createSurface 后递归显示目录支持的所有类型。
2. 输入写回顶层绑定，实际文本/状态随绑定变化。
3. 点击动作产生一次 `onAction`，重复 eventId 不重复投递。
4. `updateComponents` 替换节点后 generation 改变，节点按新 id 重建。
5. `updateDataModel` 标量更新保留当前输入语义。
6. 非法 envelope / 损坏组件批次保留上一版可见界面并报告错误。
7. 删除 surface 后无残留节点、回调或迟到写入。
8. 页面卸载后 transport 与订阅释放，不继续接收/渲染。

真实 IDE 断言应检查模拟器实际节点、文本、可见性和交互结果。headless 通过、包级测试通过或构建产物存在都不能替代目标 IDE 观察。

## 报告

每项写清 `版本/命令 → 输入 → 期望 → 实际 → 证据 → 限制`。IDE 未运行、未登录、自动化连接失败或模拟器未就绪时记录基础设施阻塞并写 `未完成最终验收`，不把替代覆盖标成真实 runtime 通过。
