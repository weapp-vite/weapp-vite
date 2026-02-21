---
title: 让 AI 学习 Weapp-vite
description: 引导任意对话式 AI 快速读取 weapp-vite 文档的 llms 入口与使用方式。
---

# 让 AI 学习 Weapp-vite

借助自动生成的 `llms.txt` 与 `llms-full.txt`，可以让任意对话式 AI 在几秒内掌握 Weapp-vite 的文档上下文。

## 快速入口

- 基础索引：`/llms.txt`（页面列表与摘要，体积小，适合作为初始指令）
- 全量内容：`/llms-full.txt`（包含文档全文，适合向量索引或离线检索）

## 推荐用法

1. 在对话开始时，要求模型先读取 `/llms.txt`，必要时再按需拉取 `/llms-full.txt` 进行检索。
2. 如果模型支持工具或文件读取，把上述链接作为可访问资源；只支持粘贴的场景，可下载后上传。
3. 结合模型常用的自定义指令/系统提示，引导它优先引用链接内容回答 Weapp-vite 相关问题。

### 示例提示词

```text
你是一名 Weapp-vite 助手。
请先访问并学习 https://vite.icebreaker.top/llms.txt。
必要时再访问 https://vite.icebreaker.top/llms-full.txt 获取细节。
回答时优先引用其中的内容，保持回答简洁、可执行。
```

## 进阶技巧

- 为长对话准备：将 `/llms-full.txt` 导入向量数据库/记忆插件，模型即可按需检索。
- 精准引用：若模型支持引用来源，要求它携带文档路径（如 `guide/`、`config/`）以便回溯。
- 页面粒度学习：在任意文档页使用右上角的 “Copy as Markdown/Download as Markdown” 按钮，快速把当前页内容交给 AI。

## 安装 Weapp-vite Skills（`npx skills add`）

如果你使用支持 Skills 的 AI 客户端，可以直接安装本仓库内的最佳实践技能，让模型按约定流程处理 weapp-vite / wevu 任务。

### 安装整个仓库的 skills

```bash
npx skills add weapp-vite/weapp-vite
# 或
npx skills add https://github.com/weapp-vite/weapp-vite
```

### 按技能路径安装（推荐）

```bash
# weapp-vite 工程化与构建最佳实践
npx skills add https://github.com/weapp-vite/weapp-vite/tree/main/skills/weapp-vite-best-practices

# wevu 组件、生命周期与状态管理最佳实践
npx skills add https://github.com/weapp-vite/weapp-vite/tree/main/skills/wevu-best-practices

# website 文档回填与导航同步
npx skills add https://github.com/weapp-vite/weapp-vite/tree/main/skills/weapp-vite-website-curator
```

### 本地路径安装

```bash
npx skills add ./skills/weapp-vite-best-practices
npx skills add ./skills/wevu-best-practices
npx skills add ./skills/weapp-vite-website-curator
```
