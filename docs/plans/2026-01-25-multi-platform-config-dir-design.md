---
title: 多平台 project.config 目录约定调整设计
date: 2026-01-25
status: draft
---

# 多平台 project.config 目录约定调整设计

## 背景与目标

现有 `weapp.multiPlatform` 采用 `config/project.config.<platform>.json` 的命名方式。为了减少多平台工程里顶层配置文件数量，并让平台配置与相关文件（如私有配置、平台特定文件）收拢在同一目录，需要将约定改为 `config/<platform>/project.config.json`。目标是：

- multiPlatform 启用时，仅支持新目录约定。
- 构建产物中复制平台目录内的所有文件，确保工具链与开发者工具所需文件完整。
- 非多平台与 `h5/web` 行为保持不变。

## 非目标

- 不提供对旧 `config/project.config.<platform>.json` 的兼容路径。
- 不支持 multiPlatform 下使用 `--project-config` 指定路径。
- 不改变输出路径计算与打包逻辑，只调整配置解析与拷贝策略。

## 新约定与行为

- 多平台启用时，读取 `{projectConfigRoot}/{platform}/project.config.json`。
- 同目录读取 `project.private.config.json` 并覆盖合并。
- `projectConfigRoot` 默认值仍为 `config`，但路径固定包含平台子目录。
- CLI `--project-config` 在 multiPlatform 下直接报错，提示迁移到新约定与期望路径示例。
- 未传 `--platform` 时沿用现有校验逻辑并给出提示。
- `miniprogramRoot/srcMiniprogramRoot` 仍决定 `mpDistRoot`，相对路径处理规则不变。

## 配置解析与数据流

加载配置时：

1. 合并 `vite.config` 与 `weapp.config` 得到 `weapp.multiPlatform`。
2. 若 `multiPlatform` 启用且目标为小程序平台，解析 `projectConfigRoot` 与平台子目录。
3. 读取 `project.config.json`/`project.private.config.json` 合并得到 `projectConfig`。
4. 解析 `miniprogramRoot/srcMiniprogramRoot` 得到 `outDir`，并将解析结果写入 configService 供构建使用。

## 产物同步策略

构建时如果 multiPlatform 启用，将 `{projectConfigRoot}/{platform}/` 整目录复制到产物根目录（`outDir` 的父目录）。复制包含子目录，确保平台特定文件随构建产物同步。若目录缺失，抛出错误以避免静默丢失配置文件。

## 监听与热更新

开发模式下：

- multiPlatform 启用时，监听 `config/<platform>/` 目录下文件变化（至少 `project.config.json` 与 `project.private.config.json`）。
- 变更触发 `scanService.markDirty()`，确保重新加载配置并驱动重建。
- multiPlatform 关闭时，保持现有仅监听根目录 `project.config.json`/`project.private.config.json` 的行为。

## 错误处理

- 缺失配置文件时，错误提示打印期望路径与迁移指引。
- 当 multiPlatform 启用但未传 `--platform`，维持现有强制校验与示例命令。
- multiPlatform 启用且使用 `--project-config` 时直接报错，提示不支持。

## 测试策略

- 单测：`loadConfig` 在 multiPlatform 下解析新路径，且禁止 `--project-config`。
- 单测：`syncProjectConfigToOutput` 支持整目录复制。
- 回归：multiPlatform 关闭时仍可使用根目录 `project.config.json`。
- watch：配置文件变更触发重新扫描的用例。

## 风险与对策

- 旧项目路径不兼容：通过清晰错误信息与迁移提示降低误用。
- 拷贝目录缺失导致构建失败：提前校验并给出可操作路径提示。
