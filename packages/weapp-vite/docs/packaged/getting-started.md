# Getting Started

## CLI 别名

`weapp-vite` 和 `wv` 完全等价。

```bash
weapp-vite build
wv build
```

## 最小工作流

### 1. 准备支持文件

```bash
weapp-vite prepare
```

如果项目里存在 `.weapp-vite` 支持文件缺失或过期，这一步会更新它们。

### 2. 本地开发

```bash
weapp-vite dev
weapp-vite dev --open
```

如果需要打开微信开发者工具并把日志桥接回终端，可使用：

```bash
weapp-vite dev --open
weapp-vite ide logs --open
```

### 3. 构建

```bash
weapp-vite build
```

### 构建并上传

```bash
wv build --upload --dry-run
wv build --upload -p weapp --uv 1.2.3 --desc "release"

# 独立命令保留六端批量上传能力
wv upload --platform jd,swan
wv upload --platform all --dry-run
```

`build --upload` 复用本次构建，构建成功并校验产物后才上传，不重复构建。六个平台为 `weapp/alipay/tt/xhs/jd/swan`；独立 `wv upload` 还支持逗号分隔或显式 `all`，每个目标先构建再上传，失败后停止后续目标。上传不自动提审或正式上线；`--dry-run` 只构建和检查产物，不校验凭据、不调用 SDK。

可在 `vite.config.ts` 中用 `weapp.upload: { version: '1.2.3', desc: '更新首页' }` 设置默认参数，命令行 `--uv` / `--desc` 优先，版本未配置时读取 `package.json.version`。普通 `build`、`dev/HMR` 不读取这组参数也不上传；`preview` 不读取该配置。`build` 上的 `--uv`、`--desc`、`--dry-run` 必须与 `--upload` 一起使用；`--watch --upload`、`-p web --upload` 会报错。

`build -p all --upload` 是“小程序 + Web”，等两者都构建成功后只上传小程序，不等于独立 `upload -p all` 的六端批量上传。

按目标安装官方工具，并通过未提交的 `.env.<mode>.local` 或 CI Secrets 提供凭据，不要在 `weapp.upload` 中添加凭据字段。AppID、微信私钥路径、支付宝 JSON 身份文件、Token、京东密钥内容和百度 `SWAN_MIN_VERSION` 的完整设置见 [CLI 上传工具与凭据](https://vite.weapp.dev/guide/cli.html#上传工具与凭据)。百度官方 CLI Token 会进入子进程参数，仅在可信隔离 runner 上运行。

旧的微信 IDE 上传请改用 `wv ide upload --project <IDE项目根> -v 1.2.3 -d "release"`；该命令依赖 IDE 登录，不额外构建。

### 构建并预览

```bash
wv preview -p tt --mode test
wv preview -p xhs,jd,swan --mode production
wv preview -p all --dry-run
```

使用同一套六端工具与凭据，先构建再调用官方预览接口，不上传开发版本、不提审、不正式发布。微信返回本次生成的本地二维码图片；支付宝、京东返回二维码图片 URL；抖音、小红书、百度返回预览链接。百度仍需 `SWAN_MIN_VERSION`，预览无需 `--uv`。旧微信 IDE 预览使用 `wv ide preview --project <IDE项目根>`，不额外构建。

### 4. 分包预下载审计

微信小程序可以检查静态跨分包跳转，并把建议输出为 JSON：

```bash
wv analyze --preload
wv analyze --preload --json --output reports/preload.json
```

该命令只读扫描原生模板、Vue SFC 和可证明来源的路由调用，不会修改源码；同时通过不写盘的分析构建读取实际分包体积，按触发页所属包汇总共享的 2 MB 额度。动态路由、业务守卫和真实访问频率仍需人工确认。构建时的显式规则见 `weapp-config.md` 中的 `weapp.routeRules.<pattern>.preload`。

### Web 预览与构建

项目根目录准备引用 `/@weapp-vite/web/entry` 的 `index.html` 后，可以复用原有小程序源码：

```bash
wv dev -p web --host
wv build -p web
```

推荐将两条命令分别固定为 `dev:web` 和 `build:web` scripts。`web` 是规范平台名，`h5` 仅作为向后兼容别名保留。Web runtime 适合浏览器兼容验证，但不替代微信 DevTools 或真机验收。

### 5. 截图验收

```bash
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
```

### 6. 启动 MCP

```bash
weapp-vite mcp
```

## 何时先读哪些文档

- 命令、脚手架、AI 工作流：[`ai-workflows.md`](./ai-workflows.md)
- 目录结构、`AGENTS.md`、`.weapp-vite`：[`project-structure.md`](./project-structure.md)
- `vite.config.ts` 与 `weapp` 配置：[`weapp-config.md`](./weapp-config.md)
- wevu 页面/组件/store 写法：[`wevu-authoring.md`](./wevu-authoring.md)
- Vue SFC 宏、`definePageMeta`、`v-model`：[`vue-sfc.md`](./vue-sfc.md)

## 常见命令

```bash
weapp-vite dev
weapp-vite dev --open
weapp-vite build
wv dev -p web --host
wv build -p web
weapp-vite open
weapp-vite preview -p weapp --mode test
weapp-vite ide preview --project ./dist/build/mp-weixin
weapp-vite ide logs --open
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
weapp-vite mcp
```
