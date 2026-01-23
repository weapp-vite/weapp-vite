# multi-platform-wevu-tdesign-demo

`weapp-vite` + `wevu` 多平台示例

## 页面结构

- TabBar：`首页` / `数据` / `表单` / `清单` / `能力`
- 子包：`组件实验室`（subpackages/lab）与 `API 场景`（subpackages/ability）

## 使用方式

### 开发

- `pnpm dev`（默认 weapp）
- `pnpm dev:alipay`
- `pnpm dev:tt`
- `pnpm dev:swan`
- `pnpm dev:jd`
- `pnpm dev:xhs`
- `pnpm dev:web`

- `pnpm dev:open` 可以打包并直接启动微信开发者工具

### 推荐写法

- 页面/组件优先使用 Vue `<script setup>`（编译宏）写法
- 配置使用 `<json>` 自定义块

### 构建

`pnpm build`（默认 weapp）

其他平台：
- `pnpm build:alipay`
- `pnpm build:tt`
- `pnpm build:swan`
- `pnpm build:jd`
- `pnpm build:xhs`
- `pnpm build:web`

### 打开微信开发者工具

`pnpm open`

## 文档地址

0. `weapp-vite`: https://vite.icebreaker.top/
1. `wevu`: https://vite.icebreaker.top/wevu/
