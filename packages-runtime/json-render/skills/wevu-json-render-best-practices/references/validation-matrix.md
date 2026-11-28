# 分层验证与产物检查

## 包级

只运行与本次改动相关的已有入口：

```sh
pnpm --filter @wevu/json-render test
pnpm --filter @wevu/json-render typecheck
pnpm --filter @wevu/json-render test:types
pnpm --filter @wevu/json-render-components test
pnpm --filter @wevu/json-render-components typecheck
pnpm --filter @wevu/json-render-components test:types
```

重点覆盖：props/actions schema、输入绑定、节点投影、动作去重与取消、结构校验、Patch 事务性、公开类型和 resolver 契约。

## 宿主应用

修改包源码后先重建受影响包，再构建应用。至少检查：

- 主包 ESM 与 resolver 产物存在。
- 组件包 `dist/miniprogram/renderer`、`dist/miniprogram/fallback` 及相对引用存在。
- 宿主应用显式包含两个依赖，页面与业务自定义组件进入最终产物。
- 从公共入口打包后的隔离执行没有 `eval` / `new Function` 尝试。

## Headless 与真实 DevTools

主路径与关键边界分别验证：

1. 首屏 catalog/spec 渲染。
2. 输入通过 `$bindState` 写回并更新可见 props。
3. 自定义节点事件进入已声明动作。
4. JSONL 增量更新保留业务输入。
5. 非法 spec/流数据保留上一版界面并给出错误。
6. 页面卸载后没有迟到状态写入、计时器或未清理流。

headless 与真实 IDE 的断言应使用同一组可观察语义：实际节点文本、可见性、事件后的状态和产物文件。不能把 `setData` 次数、Promise resolve 或构建成功单独当成显示正确。

## 报告边界

每项记录 `对象/版本 → 命令或动作 → 产物/观察 → 方法、结果、限制`。真实 IDE 未运行、未登录或基础设施失败时写 `未验证`，不把包级通过扩成 runtime 完成。
