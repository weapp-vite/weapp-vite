---
title: 六平台 E2E 前置基建设计
date: 2026-08-12
status: implemented
---

# 六平台 E2E 前置基建设计

## 目标与边界

六个平台路线固定为微信、字节、快手、支付宝、钉钉和百度。当前公开可构建平台中，微信、字节、支付宝和百度进入必跑构建门禁；快手和钉钉仅登记为 `planned`，不新增公开 `MpPlatform`，也不猜测尚未验证的模板、样式或脚本模块契约。

既有京东和小红书平台继续提供兼容性构建回归，但不属于六个平台路线。此次变更只建立测试、CI 和环境诊断基础，不新增用户可用能力，因此不需要 changeset，也不联动 `create-weapp-vite`。

## 单一验收清单

`e2e/platforms/verification.ts` 是平台复验能力的单一事实源，每个平台显式记录：

- 标准 ID、别名以及目标或兼容平台分类；
- 构建、IDE CLI、runtime automator 三层状态；
- 已验证平台的模板、样式、脚本模块、事件、项目配置和 runtime 全局对象预期；
- 工具、登录、协议或实现缺口。

契约测试要求所有公开小程序平台都有构建预期，并与 `@weapp-core/shared` 的别名保持一致。新增公开平台而未同步验收清单会直接失败；`planned` 平台不得提前填写虚构的产物预期。

## 分级复验

| 平台          | 构建产物               | IDE CLI              | Runtime automator               |
| ------------- | ---------------------- | -------------------- | ------------------------------- |
| 微信          | required               | required             | required                        |
| 字节          | required               | unsupported          | unsupported                     |
| 快手          | planned                | planned              | planned                         |
| 支付宝        | required               | optional (`minidev`) | unsupported                     |
| 钉钉          | planned                | planned              | planned                         |
| 百度          | required               | optional             | optional（显式 WebSocket 端点） |
| 京东 / 小红书 | compatibility required | unsupported          | unsupported                     |

`pnpm e2e:platform:build` 串行构建全部公开小程序平台。原生 fixture 断言文件后缀、模板引用、事件和脚本模块语义；wevu fixture 单独断言框架 runtime 平台 marker，避免把框架注入错误地当作原生构建契约。

PR CI 在 Ubuntu / Node 22 中运行独立平台构建门禁，不复制完整微信 E2E 矩阵。真实 IDE 测试仍全局串行，且不进入无登录凭据的通用 CI。

## 本机 Runtime 复验

先运行：

```sh
pnpm e2e:platform:doctor
```

支付宝可用 `pnpm e2e:platform:doctor:alipay` 要求 `minidev` 存在；缺失时稳定返回非零退出码和安装提示。

百度 automator 只连接开发者工具已经开放的自动化端点，不负责猜测或启动私有协议。设置端点后复验：

```sh
export WEAPP_VITE_SWAN_WS_ENDPOINT=ws://127.0.0.1:<port>
pnpm e2e:platform:doctor:swan
pnpm e2e:platform:runtime:swan
```

百度 suite 在 `beforeAll` 中连接一次，在用例内通过 `goto` 复用会话并切换路由，最后统一关闭。端点、登录或服务不可用属于环境未就绪，不允许通过弱化构建断言来规避。

## 后续平台接入

正式支持快手或钉钉时，实施者必须依次完成：共享平台注册和公开类型、模板编译 profile、输出扩展名与项目配置、runtime 能力描述、平台单元测试，然后把验收清单中的 `build` 从 `planned` 提升为 `required` 并填写经过官方工具验证的产物预期。IDE CLI 与 automator 只有在稳定协议和可重复运行入口存在时才能升级状态。
