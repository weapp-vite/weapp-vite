# 外部 script setup src 的相对组件导入被按宿主路径解析

建议 Issue 标题：`[Bug]: 外部 script setup src 中的相对组件导入按宿主 SFC 路径解析，导致 ENOENT`

## 环境

- macOS / Node.js 24.22.2 / pnpm 12.18.0
- weapp-vite 7.10.0 / wevu 7.10.0 / @wevu/compiler 7.10.0（锁文件固定）
- 目标平台：微信小程序
- 发生在构建阶段，不需要微信开发者工具、有效 AppID 或后端

## 一键验证

在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm run repro:external
```

脚本运行两个真实构建：

1. 无规避构建必须因错误的 `src/components/ReproLabel.vue` 路径报 `ENOENT`，而真实组件必须存在于 `shared/components/ReproLabel.vue`。
2. 只启用一条路径纠正插件的对照构建必须成功；脚本同时检查页面 `usingComponents`、WXML 标签和共享组件的 JS／WXML 产物。

**退出码 0 表示缺陷及规避对照均已确认，不表示上游已经修复。** 验证不会把任意构建失败当作复现成功，安装错误、其他错误或对照构建失败都会导致断言失败。

原始输出保存为本目录的 `build.log` 和 `build-workaround.log`，日志和构建产物均已被仓库忽略规则排除。

## 直接触发错误

无需运行验证脚本，也可直接在仓库根目录执行：

```bash
pnpm --dir examples/external-script run build
```

此命令当前预期以非零状态退出并输出 `ENOENT`。

启用规避的对照构建：

```bash
pnpm --dir examples/external-script run build:workaround
```

## 最小文件结构

```text
external-script/
├── src/
│   ├── app.vue
│   └── pages/index/index.vue
├── shared/
│   ├── pages/index/index.ts
│   └── components/ReproLabel.vue
├── package.json
├── weapp-vite.config.ts
└── verify.mjs
```

宿主页面 `src/pages/index/index.vue`：

```vue
<script setup lang="ts" src="../../../shared/pages/index/index.ts"></script>

<template>
  <ReproLabel />
</template>
```

外部脚本 `shared/pages/index/index.ts` 只有一行：

```ts
import ReproLabel from "../../components/ReproLabel.vue";
```

真实组件 `shared/components/ReproLabel.vue` 仅包含静态模板：

```vue
<template>
  <text>来自共享目录的组件</text>
</template>
```

无需包别名、workspace 源码包、外部模板或样式块，也无需组件状态和业务代码。宿主 `src/components` 下没有同名文件。

## 2026-11-13 实际结果

无规避构建的错误摘要（项目绝对路径省略）：

```text
[plugin weapp-vite:pre]
Error: ENOENT: no such file or directory, open '.../external-script/src/components/ReproLabel.vue'
[plugin vite:asset]
Error: ENOENT: no such file or directory, open '.../external-script/src/components/ReproLabel.vue'
```

解析结果等同于以宿主页面为基准计算 `../../components/ReproLabel.vue`，而不是以外部脚本为基准。真实组件并未缺失。

同一配置使用 `--mode workaround` 时，仅增加一个 `resolveId` 插件：当导入者是该宿主页面、请求是该组件相对路径时，返回真实组件的绝对路径。页面和外部脚本不变，对照构建成功。

成功产物中的页面注册：

```json
{
  "usingComponents": {
    "repro-label": "/shared/components/ReproLabel"
  }
}
```

## 预期结果与定位边界

外部脚本中的相对组件导入应相对于该脚本文件解析，构建应直接成功，并注册真实的共享组件，不应要求宿主目录提供镜像文件或项目自行纠正路径。

本复现确认的是构建链路存在错误的组件解析基准；尚未确认缺口具体位于组件发现、入口收集还是其他解析阶段，不能仅据此断言 `rebaseExternalScriptImports` 函数本身出错。
