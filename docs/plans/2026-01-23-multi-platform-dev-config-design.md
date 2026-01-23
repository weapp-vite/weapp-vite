---
title: 多平台小程序开发配置设计（multiPlatform）
date: 2026-01-23
status: draft
---

# 多平台小程序开发配置设计（multiPlatform）

## 背景与目标

当前 `weapp-vite dev` 默认依赖项目根目录的 `project.config.json`，未传 `--platform` 时会直接启动。这一行为需要保持不变。同时希望在“一份源码”的前提下，针对不同小程序平台产出不同的 `dist` 目录，并且允许每个平台有自己的 `project.config.json`。

本设计在不改动默认行为的前提下，提供一个显式开关 `weapp.multiPlatform`，以约定式配置支持多平台开发与构建。

## 目标

- 默认行为不变：未开启 `multiPlatform` 时，`weapp-vite dev` 不传 `--platform` 仍按当前逻辑启动。
- 启用 `multiPlatform` 后，必须通过 `--platform` 指定目标小程序平台。
- 允许每个平台拥有独立的 `project.config.json` 与 `project.private.config.json`。
- 产物目录通过平台配置的 `miniprogramRoot`/`srcMiniprogramRoot` 隔离，实现不同平台输出到不同 `dist`。
- `h5/web` 平台行为保持现状，不受小程序多平台约束。

## 非目标

- 不在本设计中实现“单次命令并行输出多个平台”。
- 不引入基于 apps 多目录的多端工程结构。
- 不改动构建与编译逻辑，重点仅在配置解析与路径约定。

## 现状

- `loadConfig` 在读取 `project.config.json` 后计算 `mpDistRoot`，缺失时直接报错。
- CLI 的 `--platform` 仅影响 `weapp.platform` 与运行时目标，未影响 `project.config` 路径。
- `mpDistRoot` 决定输出目录清理、watch 忽略以及产物路径。

## 方案（约定式多平台配置）

### 1) 新增配置开关

在 `weapp` 配置中新增 `multiPlatform`：

```ts
type MultiPlatformConfig
  = | boolean
    | {
      enabled?: boolean
      projectConfigRoot?: string
    }
```

- `false`/未配置：维持现有行为。
- `true`：等价于 `{ enabled: true, projectConfigRoot: 'config' }`。
- `projectConfigRoot` 默认值为 `config`，用于定位平台配置文件目录。

### 2) 新增 CLI 参数

新增 `--project-config <path>`，仅对小程序平台生效：

- 显式指定平台 project config 路径。
- 优先级高于约定式路径。
- `h5/web` 平台忽略该参数。

### 3) 平台 project config 约定

当 `multiPlatform` 启用，且目标为小程序平台：

- 默认读取 `config/project.config.<platform>.json`。
- 同目录读取 `project.private.config.<platform>.json` 并覆盖合并。
- 若 CLI 传入 `--project-config`，以该路径作为 base，并在同目录寻找对应的 `project.private.config.<platform>.json`。

### 4) 平台必填校验

启用 `multiPlatform` 后：

- 若目标为小程序平台且未传 `--platform`，直接报错并提示示例。
- 若目标为 `h5/web`，维持现有逻辑，不强制 `--platform`。

### 5) 产物目录隔离

通过每个平台 `project.config.<platform>.json` 的 `miniprogramRoot`/`srcMiniprogramRoot` 控制输出目录，例如：

- `dist/mp-weixin`
- `dist/mp-alipay`
- `dist/mp-tt`

这样无需变更打包链路，现有 `mpDistRoot` 逻辑即可实现多平台产物隔离。

## 关键实现点

- `loadConfig` 在合并配置后解析 `multiPlatform`，并根据平台决定 project config 路径。
- `getProjectConfig` 增强为可传入 `basePath`/`privatePath` 或新增专用解析函数。
- 错误提示需包含实际路径与修复建议，避免定位困难。
- `resolveRuntimeTargets` 逻辑保持不变，校验放在 `loadConfig` 内。

## 使用方式示例

```bash
# 开启 multiPlatform 后，必须指定平台
weapp-vite dev -p weapp
weapp-vite dev -p alipay

# 覆盖 project config 路径
weapp-vite dev -p weapp --project-config config/project.config.weapp.json
```

`config/` 目录示例：

```
config/
  project.config.weapp.json
  project.private.config.weapp.json
  project.config.alipay.json
  project.private.config.alipay.json
```

## 兼容性与迁移

- 旧项目不启用 `multiPlatform` 时行为完全一致。
- 新项目可逐步迁移，将平台配置迁入 `config/` 并打开开关。

## 测试策略

- 单测：`loadConfig` 在 `multiPlatform` 下的路径解析与错误提示。
- 回归：未开启时 `weapp-vite dev` 仍可使用现有 `project.config.json` 启动。
- 集成：不同平台配置分别输出到不同 `dist` 目录。

## 风险与对策

- 用户忘记传 `--platform`：错误提示明确示例命令。
- 路径约定误用：在错误信息中打印期望路径与 `--project-config` 替代方案。
