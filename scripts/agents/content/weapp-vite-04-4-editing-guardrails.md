## 4. Editing Guardrails

- Prefer minimal diffs in generated-code string assertions: verify behavior intent, not fragile formatting trivia.
- 对生成代码、dist 产物、bundle wrapper 的断言，不要绑定随机 helper/import 别名、局部变量名或 hash 后缀；例如不要写死 `require_store_fwgCLl_K`、`require_src__P44BAOw`、`_sfc_main$1` 这类名字。
- 需要覆盖生成代码时，优先断言稳定语义：公开导出名、marker、字面量、相对路径、对象/调用结构、宿主 API 名；不要把编译器临时命名当作契约。
- 新增或迁移会跨 chunk / prelude / runtime / tests 共享的稳定 marker、导出名或宿主 key 时，优先放到 `@weapp-core/constants`，不要把这类常量只留在 `packages/weapp-vite` 的局部实现文件里。
- When a behavior change is intentional, update:
  - transform implementation
  - unit tests
  - related e2e (if runtime-visible)
- Keep changes local to `packages/weapp-vite` unless there is a clear interface contract change.
