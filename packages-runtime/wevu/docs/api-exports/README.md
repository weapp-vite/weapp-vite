# wevu 用户入口类型导出总览

本文档基于 `packages-runtime/wevu/package.json#exports`、`dist/*.d.mts` 与运行时入口导出对照整理。

## 入口统计

| 入口               | 子路径          | 类型导出总数 | 仅类型导出（推断） | 运行时同名导出 | 明细                        |
| ------------------ | --------------- | -----------: | -----------------: | -------------: | --------------------------- |
| `wevu`             | `.`             |          423 |                273 |            150 | [查看](wevu-root.md)        |
| `wevu/compiler`    | `./compiler`    |            0 |                  0 |              0 | [查看](wevu-compiler.md)    |
| `wevu/jsx-runtime` | `./jsx-runtime` |            1 |                  1 |              0 | [查看](wevu-jsx-runtime.md) |
| `wevu/store`       | `./store`       |           11 |                  8 |              3 | [查看](wevu-store.md)       |
| `wevu/api`         | `./api`         |            0 |                  0 |              0 | [查看](wevu-api.md)         |
| `wevu/fetch`       | `./fetch`       |            5 |                  4 |              1 | [查看](wevu-fetch.md)       |
| `wevu/web-apis`    | `./web-apis`    |            2 |                  0 |              2 | [查看](wevu-web-apis.md)    |
| `wevu/router`      | `./router`      |           54 |                 43 |             11 | [查看](wevu-router.md)      |
| `wevu/vue-demi`    | `./vue-demi`    |          427 |                273 |            154 | [查看](wevu-vue-demi.md)    |

## 文档列表

- [wevu-root.md](wevu-root.md)
- [wevu-compiler.md](wevu-compiler.md)
- [wevu-jsx-runtime.md](wevu-jsx-runtime.md)
- [wevu-store.md](wevu-store.md)
- [wevu-api.md](wevu-api.md)
- [wevu-fetch.md](wevu-fetch.md)
- [wevu-web-apis.md](wevu-web-apis.md)
- [wevu-router.md](wevu-router.md)
- [wevu-vue-demi.md](wevu-vue-demi.md)
- [../router-usage-guide.md](../router-usage-guide.md)
- [../router-quickstart.md](../router-quickstart.md)
- [../router-migration-guide.md](../router-migration-guide.md)
- [../router-vue-router-parity.md](../router-vue-router-parity.md)

## 说明

- “仅类型导出（推断）”定义：存在于 `.d.mts` 导出名中，但不在对应 `.mjs` 运行时导出名中。
- 对 `export * from "..."` 的透传入口，列表仅反映该入口声明文件本身；原包内部完整清单请在源包审阅。
