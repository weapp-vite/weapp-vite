# ES5 最终产物紧凑输出

PR #1323 将 SWC 后移到最终产物阶段，覆盖后注入 prelude，但 SWC 默认打印会重新展开已经压缩的代码。本次保留降级阶段和原生 writer，修复最终打印策略。

选择在现有 SWC 调用中启用顶层 `minify`，只移除打印空白，不重复运行优化或变量重命名。移回 `renderChunk` 会重新漏掉注入代码；追加独立压缩阶段会增加转换成本及映射维护，两者均不采用。

Rolldown 的规范化 `minify` 不包含 `codegen`。输入插件在 `outputOptions` 阶段解析原始打印策略，追加仅捕获布尔值的 output 插件，在 `renderStart` 将策略关联到该 output 的规范化选项；最终转换读取并立即释放 WeakMap 项。不同 output 和构建实例互不覆盖，不保留原始配置、bundle 或插件上下文。原有转换与发布 hook 顺序保持不变。

真实 CLI 验证还发现 miniprogram 的 defu 后规范化用默认 `plugins` 覆盖了已合并插件，导致 ES5 插件未进入最终构建。此处保留已合并列表，展开嵌套配置并按实例去重，避免内置 Oxc 重复注册。该既有配置模块超过 300 行，本次只修改插件字段的归一化，不迁移无关路径与类型；后续按配置职责单独拆分。

独立分包将 installer 与页面合入同一文件时，局部绑定注入还会在 installer 依赖的常量初始化前调用它。存在源码安装调用时，复用该调用并在返回后同步占位绑定，保留原返回值和业务自有绑定。调用范围并入已有一次 AST 分析；没有缓存时才独立解析，支持嵌套调用并排除局部同名绑定。新增逻辑放在 `requestGlobals/inlineBindings.ts`，既有大文件仅增加调用入口。

行为边界：

- `minify: true`、默认对象和显式 `removeWhitespace: true` 产生紧凑 ES5。
- `false`、`dce-only`、`codegen: false` 和 `removeWhitespace: false` 保持可读打印。
- 原生 compressor、mangle 和自定义选项继续由 bundler 处理。
- chunk、字符串及字节形式的 JS asset 使用相同打印策略；非 JS asset 保持原样。
- 三种 prelude 模式、external/inline/hidden sourcemap、增量 marker 和执行结果继续成立。

验证先在旧实现运行新增真实 Vite 回归，确认失败，再验证修复。定向测试覆盖多次 generate、多输出格式切换、真实 watch 重建和共享插件实例的独立构建；扩展实际磁盘产物、映射和 prelude 执行测试，补充既有 fixture 的 provider-compatible runtime 场景。包级 lint、typecheck、build 和原生 hooks 完成后创建 PR，以当前 head 的全部适用 CI/CD 终态作为交付门槛。真实 DevTools 最终验收单独记录，未执行或环境阻塞不计通过。
