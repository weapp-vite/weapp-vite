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
wv build --upload -p weapp

# 独立命令保留六端批量上传能力
wv upload --platform jd,swan
wv upload --platform all --dry-run

# 内置自动版本演练：不修改版本或锁文件
wv upload -p xhs,tt --mode test --bump patch --git-desc --dry-run
```

`build --upload` 复用本次构建，构建成功并校验产物后才上传，不重复构建。六个平台为 `weapp/alipay/tt/xhs/jd/swan`；独立 `wv upload` 还支持逗号分隔或显式 `all`，每个目标先构建再上传，失败后停止后续目标。上传不自动提审或正式上线；`--dry-run` 只构建和检查产物，不校验凭据、不调用 SDK。

通常无需添加 `weapp.upload`：默认读取业务 `package.json.version`，说明自动生成为 `项目名@版本`；默认不升版、不读取 Git、不运行 npm。需要覆盖时传 `--uv` / `--desc` 或配置 `weapp.upload`；本地自动版本显式使用 CLI `--bump patch|minor|major` / `--git-desc`，二者分别与 `--uv` / `--desc` 冲突，不是 Vite 配置字段。真实升版需要本机 npm，只有 Git 说明要求已有提交的 Git 仓库。完整 `.env.test` / `.env.production`、独立 AppID、本地自动升版与 CI 配置见[上传环境与自动版本](https://vite.weapp.dev/guide/upload/environments.html)。普通 `build`、`dev/HMR` 不上传；配置仍正常求值。`build` 的上传专属参数必须与 `--upload` 一起使用，不能用于 watch 或 Web-only。

自动元数据在首次配置求值、编译前准备一次，批量共用；升版仅处理命令根目录的应用清单，不向父目录查找、不执行生命周期钩子、不 commit/tag/push。dry-run 不运行 npm、不修改版本或锁文件，直接导入 `package.json` 的构建代码仍读取原始版本。实际升版后的构建或上传失败不回滚，重试去掉 `--bump` 并复用原版本。完整边界见[本地速查](./upload.md#内置本地自动版本)。

`build -p all --upload` 是“小程序 + Web”，等两者都构建成功后只上传小程序，不等于独立 `upload -p all` 的六端批量上传。

多个平台推荐使用一份 `weapp.multiPlatform.projectConfigs` 映射，公共字段用对象展开，各平台只提供 AppID 和差异；标准项目 JSON 由构建器生成，不必手工维护六份文件。原生文件方式仍可使用，完整示例见本地[上传速查](./upload.md#多平台与输出校验)。

按目标安装官方工具，并通过未提交的 `.env.<mode>.local` 或 CI Secrets 提供凭据，不要在 `weapp.upload` 中添加凭据字段。先读本地 [六端上传与预览速查](./upload.md)，再按[分平台操作指南](https://vite.weapp.dev/guide/upload.html)配置 AppID、密钥或 Token。淘宝不在支持列表内；百度官方 CLI Token 会进入子进程参数，仅在可信隔离 runner 上运行。

旧的微信 IDE 顶层上传仍可原样执行，不额外触发 weapp-vite 构建：

```bash
wv upload --project ./dist --version 1.2.3 --desc "release"
wv upload -p ./dist -v 1.2.3 -d "release"
```

SDK 命令 `wv upload -p weapp` 无需 `--project`，会自动定位本次构建产物。这里的 `./dist` 只是假设旧 IDE 工程根位于该目录，不是默认值，应按实际 `project.config.json` 所在目录填写；旧入口省略定位参数时保持透传，不自动补 `dist`。

旧顶层语法每次只警告一次未来弃用，不要求立即迁移；稳定的显式 `wv ide upload -p ./dist -v 1.2.3 -d "release"` 不弃用、不警告，仍依赖 IDE 登录。若改用 SDK，需要从源码项目根安装 `miniprogram-ci`、配置 AppID、上传私钥和 IP 白名单，再执行 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`；不复用 IDE 登录，也不能把旧 `--project` 的产物目录直接作为 SDK `[root]`。

`-p` 只有与明确旧标记（如 `--version/-v` 或 `--project`）一起出现时才是 IDE 项目目录，否则是平台，不猜测路径。新旧方言混用在 IDE、构建或升版副作用前报错，`--dry-run` / `--bump` / `--git-desc` 不能用于旧 IDE 上传。`wv upload --help` 是 SDK 帮助，`wv help upload` 保留旧 IDE 帮助并警告，`wv ide help upload` 不警告。完整标记、短参数和 `=` / `--` 规则见[本地速查](./upload.md#旧上传兼容与迁移)。

### 构建并预览

```bash
wv preview -p tt --mode test
wv preview -p xhs,jd,swan --mode production
wv preview -p all --dry-run
```

使用同一套六端工具与凭据，先构建再调用官方预览接口，不上传开发版本、不提审、不正式发布。微信返回本次生成的本地二维码图片；支付宝、京东返回二维码图片 URL；抖音、小红书、百度返回预览链接。百度仍需 `SWAN_MIN_VERSION`；预览不使用上传默认参数，不接受 `--uv`、`--bump` 或 `--git-desc`。旧微信 IDE 预览使用 `wv ide preview --project <IDE项目根>`，不额外构建。

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
- Vue SFC 宏、`definePageMeta`、`definePage`、`v-model`：[`vue-sfc.md`](./vue-sfc.md)

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
