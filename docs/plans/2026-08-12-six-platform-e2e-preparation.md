---
title: 六平台 E2E 前置基建设计
date: 2026-08-12
status: implemented
---

# 六平台 E2E 前置基建设计

## 目标与边界

六个平台路线固定为微信、字节、快手、支付宝、钉钉和百度。当前公开可构建平台中，微信、字节、支付宝和百度进入必跑构建门禁；快手和钉钉仅登记为 `planned`，不新增公开 `MpPlatform`，也不猜测尚未验证的模板、样式或脚本模块契约。

既有京东和小红书平台继续提供兼容性构建回归，但不属于六个平台路线。平台基建完成后，支付宝兼容继续形成了完整闭环：原生 `.axml` / `.acss` 成为一等输入，页面、组件、分包、自动路由、watcher 和原生 layout 共用平台感知的 sidecar 选择契约；最终产物归一化不再把官方 `import-sjs` 标签错误降级为 `sjs`，独立 SJS 也不会被错误转换成支付宝禁止的 `module.exports` 格式。集成验收同时覆盖原生页面、原生组件、原生分包、Vue SFC、wevu runtime、SJS 与 `antd-mini`。

抖音兼容在同一基础上补齐原生 `.ttml` / `.ttss` 一等输入，模板、样式、watcher、自动路由、layout 和 sidecar 选择统一从共享平台描述派生。集成验收覆盖原生 App、Page、Component、WXS、原生分包、本地 npm 原生组件以及 Vue/wevu 页面共存。支付宝与抖音的源码行为变化都需要 changeset，并按仓库规则联动 `create-weapp-vite`。

## 单一验收清单

`e2e/platforms/verification.ts` 是平台复验能力的单一事实源，每个平台显式记录：

- 标准 ID、别名以及目标或兼容平台分类；
- 构建、IDE CLI、runtime automator 和模拟器四层状态；
- 已验证平台的模板、样式、脚本模块、事件、项目配置和 runtime 全局对象预期；
- 工具、登录、协议或实现缺口。

契约测试要求所有公开小程序平台都有构建预期，并与 `@weapp-core/shared` 的别名保持一致。新增公开平台而未同步验收清单会直接失败；`planned` 平台不得提前填写虚构的产物预期。

## 分级复验

| 平台          | 构建产物               | IDE CLI              | Runtime automator               | 模拟器      |
| ------------- | ---------------------- | -------------------- | ------------------------------- | ----------- |
| 微信          | required               | required             | required                        | required    |
| 字节          | required               | unsupported          | unsupported                     | optional    |
| 快手          | planned                | planned              | planned                         | planned     |
| 支付宝        | required               | optional (`minidev`) | unsupported                     | optional    |
| 钉钉          | planned                | planned              | planned                         | planned     |
| 百度          | required               | optional             | optional（显式 WebSocket 端点） | optional    |
| 京东 / 小红书 | compatibility required | unsupported          | unsupported                     | unsupported |

`pnpm e2e:platform:build` 串行构建全部公开小程序平台。原生 fixture 断言文件后缀、模板引用、事件和脚本模块语义；wevu fixture 单独断言框架 runtime 平台 marker，避免把框架注入错误地当作原生构建契约。微信、支付宝和字节的 wevu 模板快照也在该入口中实际执行，显式选择平台时不再把支付宝或字节静默跳过。

抖音额外构建 `apps/douyin-native-demo`。fixture 以 `.ttml` / `.ttss` 为原生源码，覆盖原生 App、Page、Component、分包、layout、WXS、本地 `file:` npm 原生组件、Vue SFC、wevu runtime 和 `MP_PLATFORM=tt` marker。源码优先级为 `.ttml > .wxml > .html` 与 `.ttss > .wxss > .css > 预处理器`；原生 TTML 进入保留模式，便携 WXML 与 Vue SFC 继续执行目标平台转换。

支付宝额外构建 `apps/alipay-antd-mini-demo`。fixture 直接以 `.axml` / `.acss` 作为原生源码，不保留 `.wxml` 回退文件，并覆盖原生 App/Page/Component、`props` / `deriveDataFromProps` / `didMount` / methods、原生分包、`a:if`、`onTap`、`import-sjs`、保留 `export default` 且不依赖 `module.exports` 的 SJS、Vue SFC、`antd-mini` npm 组件落位以及 `MP_PLATFORM=alipay` runtime marker。

源码选择采用确定性优先级：支付宝模板为 `.axml > .wxml > .html`，样式为 `.acss > .wxss > .css > 预处理器`。原生同平台 `.axml` 进入保留模式，不改写 `onTap`、`a:*`、`import-sjs from/name` 和组件标签；便携 `.wxml` 与 Vue SFC 进入归一化模式。路线 A（`weapp-vite + 原生支付宝`）是完整交付终点，路线 B 允许在同一项目按页面逐步加入 Vue SFC，不要求一次性重写原生业务。

PR CI 在 Ubuntu / Node 22 中运行独立平台构建门禁，不复制完整微信 E2E 矩阵。真实 IDE 测试仍全局串行，且不进入无登录凭据的通用 CI。

## 本机 Runtime 复验

先运行：

```sh
pnpm e2e:platform:doctor
```

支付宝可用 `pnpm e2e:platform:doctor:alipay` 要求 `minidev` 存在；缺失时稳定返回非零退出码和安装提示。

抖音可运行：

```sh
pnpm e2e:platform:doctor:tt
pnpm e2e:platform:open:tt
```

前者检测 macOS 抖音开发者工具路径和版本，后者构建 demo 并打开官方开发者工具。抖音目前没有稳定公开的 IDE CLI 或 automator，真实交互通过本机沙盒应用和模拟器完成，不进入通用 CI。固定复验覆盖原生首页、计数组件、npm 原生组件事件、原生分包往返、Vue/wevu 响应式更新、Vue 内 npm 组件事件、`tt` runtime marker 和控制台错误检查。

本机存在 `minidev` 时，可运行：

```sh
pnpm e2e:platform:runtime:alipay
```

该命令先用 weapp-vite 完整构建支付宝示例，再调用官方 `minidev build --machine-output` 编译临时产物，确认 `ant-button` 等组件被支付宝工具链识别，完成后自动清理临时目录。该入口不依赖登录，但依赖本机 `minidev`，因此保持 optional，不进入无工具的通用 CI。

真实运行时手工复验覆盖原生组件初始状态与事件更新、原生分包导航、Vue SFC 页面导航和状态更新，并检查控制台错误。当前结论只覆盖上述 fixture 和支付宝 Lite 模拟器；支付、授权、云服务、插件、真机专属 API 及业务域能力不在本次兼容声明内。

百度 automator 只连接开发者工具已经开放的自动化端点，不负责猜测或启动私有协议。设置端点后复验：

```sh
export WEAPP_VITE_SWAN_WS_ENDPOINT=ws://127.0.0.1:<port>
pnpm e2e:platform:doctor:swan
pnpm e2e:platform:runtime:swan
```

百度 suite 在 `beforeAll` 中连接一次，在用例内通过 `goto` 复用会话并切换路由，最后统一关闭。端点、登录或服务不可用属于环境未就绪，不允许通过弱化构建断言来规避。

## 后续平台接入

正式支持快手或钉钉时，实施者必须依次完成：共享平台注册和公开类型、模板编译 profile、输出扩展名与项目配置、runtime 能力描述、平台单元测试，然后把验收清单中的 `build` 从 `planned` 提升为 `required` 并填写经过官方工具验证的产物预期。IDE CLI 与 automator 只有在稳定协议和可重复运行入口存在时才能升级状态。
