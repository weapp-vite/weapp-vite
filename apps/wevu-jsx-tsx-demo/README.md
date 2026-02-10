# Wevu JSX / TSX Demo

演示 `weapp-vite + wevu` 在小程序中直接编写以下页面形态：

- 纯 `JSX` 页面（`.jsx`）
- 纯 `TSX` 页面（`.tsx`）
- Vue 风格 `TSX` 页面（从 `vue` 导入 `defineComponent`）

## 启动

```bash
pnpm --filter wevu-jsx-tsx-demo dev
```

## 构建

```bash
pnpm --filter wevu-jsx-tsx-demo build
```

## 页面列表

- `pages/jsx-basic/index`：纯 JSX
- `pages/tsx-basic/index`：纯 TSX
- `pages/vue-tsx/index`：Vue 风格 TSX
