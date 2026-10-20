# 严格普通 npm DOM 类型回归

将此目录复制到仓库之外的临时消费者，使用普通 npm 安装当前提交打包的 `wevu` 及其工作区依赖 tarball、TypeScript 6.0.3，然后分别执行：

```sh
node node_modules/typescript/bin/tsc -p tsconfig.NodeNext.json
node node_modules/typescript/bin/tsc -p tsconfig.Bundler.json
```

安装时使用现有 consumer tarball/provenance 工具，不能通过工作区软链接、额外宿主类型或 tsconfig paths 补齐声明。两个配置均保持 `types: []`、`strict: true`、`skipLibCheck: false`，保留全部原始诊断。

`consumer.ts` 的断言验证浏览器 `map`/`canvas` 类型、原生标签不进入 DOM map、所有浏览器标签均满足 `Element`，并保留原生 `TemplateRefValue.selector` 的公开类型。基线应出现 DOM map 污染导致的消费者断言和 `lib.dom` 泛型约束错误。

微信 SDK 另有 `console`、XRFrame 的 `HTMLCanvasElement`、`HTMLImageElement`、`ImageData` 与 DOM 重复声明。这些诊断必须单独归因，不得过滤后把整条编译命令写为通过。只有完整编译退出码为零才属于严格消费者通过。

无 SDK 的编译器阳性/阴性对照位于 `packages/volar/test/templateRefDom.test.ts`；真实 SFC、模板 ref 精度和源码位置回归位于 `packages/volar/test/templateRef.test.ts` 及其 `fixtures/template-ref`。这几层分别检验编译器检测能力、SFC 类型行为和真实发布依赖图，不能互相替代。
