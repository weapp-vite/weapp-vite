# Wevu JSX 类型导出清单

五个 JSX 子路径均为类型专用入口，不提供运行时导出。

| 入口                           | 子路径                      | 类型入口                               | 类型导出数 |
| ------------------------------ | --------------------------- | -------------------------------------- | ---------: |
| `wevu/jsx-runtime`             | `./jsx-runtime`             | `./dist/jsx-runtime.d.mts`             |          7 |
| `wevu/weapp/jsx-runtime`       | `./weapp/jsx-runtime`       | `./dist/weapp/jsx-runtime.d.mts`       |          9 |
| `wevu/alipay/jsx-runtime`      | `./alipay/jsx-runtime`      | `./dist/alipay/jsx-runtime.d.mts`      |          9 |
| `wevu/tt/jsx-runtime`          | `./tt/jsx-runtime`          | `./dist/tt/jsx-runtime.d.mts`          |          9 |
| `wevu/miniprogram/jsx-runtime` | `./miniprogram/jsx-runtime` | `./dist/miniprogram/jsx-runtime.d.mts` |          9 |

## 中性入口

1. `JSX`
2. `WevuJsxChild`
3. `WevuJsxElement`
4. `WevuJsxEventHandler`
5. `WevuJsxGlobalComponents`
6. `WevuJsxHostAttributes`
7. `WevuJsxTeleportProps`

中性 `JSX.IntrinsicElements` 仅包含类型化的全局组件，不包含任何平台原生标签。此外，中性入口提供全局 `Teleport` 组件声明，支持直接在 TSX 中书写 `<Teleport to="body">`，实际映射由编译器完成。

## 平台入口

每个平台入口均导出中性入口的六个 `WevuJsx*` 类型、自有的 `JSX` 命名空间，以及对应的基础属性和原生元素映射：

- 微信：`WeappIntrinsicElementBaseAttributes`、`WeappIntrinsicElements`。
- 支付宝：`AlipayIntrinsicElementBaseAttributes`、`AlipayIntrinsicElements`。
- 抖音：`TtIntrinsicElementBaseAttributes`、`TtIntrinsicElements`。
- 三端公共：`MiniProgramIntrinsicElementBaseAttributes`、`MiniProgramIntrinsicElements`。

各入口的 `JSX.IntrinsicElements` 相互隔离，并共同消费 `WevuJsxGlobalComponents` 扩展。
