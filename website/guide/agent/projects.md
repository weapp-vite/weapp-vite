---
title: "接入小程序项目"
description: "识别工程结构并沿用现有技术栈。"
sidebar:
  order: 3
---

## 支持范围

首版面向微信小程序，识别 weapp-vite 原生项目与 Wevu 项目。未知工程仍可使用通用文件工具，但不保证其构建或框架适配。

自动读取 `package.json`、`project.config.json`、静态可识别的 Vite 路径配置，以及原生 `app.json`。动态生成的页面或路径需要 agent 结合源码检查；识别结果中的 `warnings` 会说明推断边界。

## 项目约定

读取根目录及子目录中的 `AGENTS.md`、`AGENTS.local.md`，标注它们适用的目录。存在已安装的 weapp-vite 文档时，优先使用与当前依赖对应的说明。

使用 `weapp-agent -C /path/to/project doctor` 查看技术栈、目录、脚本、MCP 和凭据是否就绪。诊断不会调用付费模型。

## 工程边界

保持原有包管理器和框架。新增页面或组件时维护对应路由和配置；不要通过复制 dist 产物隐藏源码问题。

在 monorepo 中用 `-C` 指向具体小程序包。路径解析会拒绝越界和指向外部的符号链接。通用检索跳过生成目录、依赖和敏感文件。
