# Weapp Agent

**让 AI 写完的小程序代码，更容易被验证和交付。**

[文档](https://agent.weapp.dev) · [English](README.en.md) · [贡献指南](CONTRIBUTING.md)

面向 weapp-vite 原生与 Wevu 微信项目的交付能力层。通过 MCP 和 CLI 为 Codex 等宿主提供工程诊断、确定性验收与截图日志，不需要第二个模型或 API Key。保留独立 AI CLI 模式。

## 当前状态

源码预览版。仓库提供可运行实现和可打包 CLI。实际验收记录见 [VALIDATION.md](VALIDATION.md)，模拟测试与真实模型、DevTools 验证分别记录。

## 安装预览包

从 npm 安装预览版：

```bash
npm install --global @weapp-agent/cli@preview
weapp-agent --version
```

## 从源码开始

需要 Node.js 24.15+、pnpm。

```bash
corepack enable
pnpm install
pnpm build
node apps/cli/dist/index.mjs --help
pnpm --filter @weapp-agent/cli pack --pack-destination ../../artifacts
```

将生成的 `.tgz` 安装到全局，或直接通过 `node` 调用构建入口。

使用已有 AI 宿主时，先阅读[无模型接入指南](apps/docs/src/content/docs/acceptance.mdx)。以下命令用于独立 agent 模式：

```bash
weapp-agent init --provider openai --model YOUR_MODEL
# 在终端环境中设置 OPENAI_API_KEY
weapp-agent doctor
weapp-agent --trust run "为首页增加一个计数器，执行构建与测试"
weapp-agent
```

新建项目：

```bash
weapp-agent init my-miniapp --create --template wevu --model YOUR_MODEL
cd my-miniapp
pnpm install
weapp-agent --trust
```

## 在现有 AI 工具中验收

以下新入口需要包含本次改动的构建包，尚未发布到 npm：

```bash
weapp-agent init
weapp-agent doctor --json
# 审阅项目脚本、配置与场景后
weapp-agent --trust accept --json
weapp-agent -C /absolute/path/to/project mcp
weapp-agent skill .agents/skills/weapp-acceptance
```

在配置的 `acceptance.scenarios` 中列出场景 JSON 文件。默认要求 build 和 devtools 都通过；缺少场景返回未验证。MCP 提供 inspect/start/status/cancel/report 五类操作，宿主负责代码修改和修复。新报告为 version 2，绑定源码摘要，支持取消和中断识别，报告不会自动重放交互。旧 `verify` 输出继续兼容。

[接入、场景格式与排错](apps/docs/src/content/docs/acceptance.mdx) · [计数器场景](examples/acceptance/counter.json) · [实施状态与发布门槛](ROADMAP.md) · [对照评测](benchmarks/README.md)

## 工作方式

- **模型独立：** OpenAI Responses、Anthropic Messages、OpenAI-compatible；支持参考截图。
- **修改可检查：** 流式进度、代码差异、文件哈希冲突检测，保留用户现有改动。
- **验证有边界：** 类型检查、构建、测试、DevTools 分别报告，缺失检查标记未验证。
- **会话可恢复：** 本地 JSONL 日志，不自动重放中断的副作用操作。
- **权限可理解：** 可信项目内编辑和已配置检查自动执行；任意 Shell、未知 MCP、上传发布需确认。
- **自动化接口：** `run --json` 输出版本化事件；`verify --json` 输出检查报告。

```bash
weapp-agent run "参考截图实现首页" --image reference.png
weapp-agent sessions
weapp-agent resume SESSION_ID "继续修复失败的检查"
weapp-agent verify --json
```

`--trust` 表示你已审阅该项目脚本与配置。工具权限控制不是 OS 沙箱。任务内容和所需源码、截图会发往配置的模型服务，会话保存在本机。不要在提示词或配置中放置密钥。

## 开发

```bash
pnpm validate
pnpm exec repo doctor
pnpm exec repo check
pnpm docs:dev
```

工程由 [repoctl](https://github.com/icelib/repoctl) 创建，文档由 [Nimbus](https://github.com/cloudflare/nimbus) 创建。核心、模型适配、小程序工具和终端界面相互分离。设计参考与固定源码版本见 [架构文档](https://agent.weapp.dev/architecture)。

## License

[MIT](LICENSE)。第三方项目的商标与许可证归各自维护者所有。
