# wevu 用户入口类型导出总览

本文档基于 `packages/wevu/package.json#exports` 与 `dist/*.d.mts` 自动提取。

## 入口统计

| 入口               | 子路径          | 类型导出总数 | 仅类型导出（推断） | 运行时同名导出 | 明细                        |
| ------------------ | --------------- | -----------: | -----------------: | -------------: | --------------------------- |
| `wevu`             | `.`             |          250 |                135 |            115 | [查看](wevu-root.md)        |
| `wevu/compiler`    | `./compiler`    |            0 |                  0 |              0 | [查看](wevu-compiler.md)    |
| `wevu/jsx-runtime` | `./jsx-runtime` |            1 |                  1 |              0 | [查看](wevu-jsx-runtime.md) |
| `wevu/store`       | `./store`       |           11 |                  8 |              3 | [查看](wevu-store.md)       |
| `wevu/api`         | `./api`         |            0 |                  0 |              0 | [查看](wevu-api.md)         |
| `wevu/router`      | `./router`      |           51 |                 41 |             10 | [查看](wevu-router.md)      |

## 文档列表

- [wevu-root.md](wevu-root.md)
- [wevu-compiler.md](wevu-compiler.md)
- [wevu-jsx-runtime.md](wevu-jsx-runtime.md)
- [wevu-store.md](wevu-store.md)
- [wevu-api.md](wevu-api.md)
- [wevu-router.md](wevu-router.md)
- [../router-usage-guide.md](../router-usage-guide.md)
- [../router-quickstart.md](../router-quickstart.md)
- [../router-migration-guide.md](../router-migration-guide.md)

## 说明

- “仅类型导出（推断）”定义：存在于 `.d.mts` 导出名中，但不在对应 `.mjs` 运行时导出名中。
- 对 `export * from "..."` 的透传入口，列表仅反映该入口声明文件本身；原包内部完整清单请在源包审阅。
