## 3. Coding Rules

- TypeScript + ESM + 2-space indentation.
- 所有场景都不要使用 Prettier 做格式化；代码与文档格式修正统一走 ESLint（包含 `eslint --fix` 与仓库现有 lint-staged / husky 流程）。
- Package names: kebab-case.
- Variables/files: camelCase.
- Classes/types: PascalCase.
- Prefer named exports unless a file intentionally owns a single default export.
- 跨包共享、会进入最终运行时代码、或需要在多个包/测试之间保持稳定值的 runtime marker / key / helper-name 常量，优先收敛到 `@weapp-core/constants`；不要把这类常量继续散落在 `packages/weapp-vite` 的单文件内部。
- Prefer root-cause fixes over symptom patches. If a regression is caused by ownership confusion between watcher layers, invalidation paths, or build stages, restore a single clear source of truth instead of stacking another fallback on top.
- Take a long-term engineering approach: avoid “just make this case pass” changes that increase duplicate triggers, hidden coupling, or architectural debt. Prefer solutions that simplify the steady-state model and reduce future debugging cost.
- Final build outputs under `dist`, mini-program output directories, and plugin output directories must come from Vite/Rolldown native emit/write; do not generate them by directly calling `writeFile` for dev/HMR fallback, sync, patch-up, or cleanup.
- If an approach only works by manually writing bundle files back to disk, treat it as an architectural violation; prefer fixing entry invalidation, watchers, plugin emit behavior, or bundler write-stage integration so the bundler still owns persistence.
- 对 Rust / native 加速路径，默认把 JS ↔ Rust 通信次数视为首要性能约束之一。不要把同一份源码上的多个小 AST 检查拆成多个 N-API 调用；优先设计 batch analysis，一次传入源码、一次 parse、一次返回结构化结果。只有 profile 证明单点 native 调用有净收益时，才接受细粒度 native API 进入热路径。
- native AST 快速路径必须保持可选依赖和显式启用；加载失败、解析失败或 native 运行失败时要回退现有 Babel/Oxc/Vue compiler 路径。新增 native 覆盖时必须同时补充 correctness 对齐测试和实际 profile，不能只依据 micro benchmark 或理论倍率扩大迁移范围。
- Keep eslint/stylelint clean and avoid introducing TypeScript errors.
- Always fix stylelint issues in standalone style files and in `<style>` blocks inside `.vue` files (including generated style outputs).
- JSDoc comments must be in Chinese.
- If a source file exceeds 300 lines, evaluate splitting and document the decision in PR notes.
- When splitting, prefer directory layout:
  - `foo/index.ts`
  - `foo/style.ts`
  - `foo/helpers.ts`
  - avoid `foo.style.ts` / `foo.helpers.ts`.

### 3.1 Rust / Native Performance Guard

- 使用 Rust/native 加速 JS 构建链路时，默认把“减少 JS 与 Rust 往返次数”作为首要性能约束；跨语言调用的固定成本、序列化/反序列化和 AST 数据搬运通常会吞掉单点 native 优化收益。
- 优先设计粗粒度 native API：一次传入完整源码、配置和需要的分析/转换任务，一次返回结构化结果；避免把 parse、traverse、query、patch、generate 拆成多次 JS<->Rust 请求。
- 如果一个优化需要多次跨边界读取 AST 节点或逐节点回调 JS，先重新评估是否应继续留在 JS/Babel/Oxc，或改成 native 端批处理后再返回摘要。
- 引入 native POC 前必须保留 JS/Oxc fallback，并用 benchmark 证明真实热路径收益；只有在减少通信次数后仍有稳定收益，才扩大迁移范围。
