---
title: Wevu JSX 类型入口
description: 介绍 Wevu 的五个 JSX 类型前缀、平台归属、公共子集与迁移方式。
keywords:
  - wevu/jsx-runtime
  - wevu/weapp
  - wevu/alipay
  - wevu/tt
  - wevu/miniprogram
  - jsx
  - typescript
---

# Wevu JSX 类型入口

Wevu 提供五个 `jsxImportSource` 前缀。它们都是**纯类型入口**：只负责 TypeScript 的 JSX 命名空间、内建标签和全局组件类型，不提供 `jsx`、`jsxs` 或其他运行时工厂。

`compilerOptions.jsx` 必须保持为 `"preserve"`。TypeScript 完成类型检查后保留 JSX，由现有 Wevu 编译链继续处理；不要因为这些入口的名称而改用需要运行时工厂的 JSX 输出模式。

更换这些前缀只改变类型归属，不改变编译器输出的 WXML、AXML 或 TTML，也不改变运行时渲染行为。

## 五个前缀

| `jsxImportSource`  | TypeScript 解析的类型入口      | 标签归属                                                                      |
| ------------------ | ------------------------------ | ----------------------------------------------------------------------------- |
| `wevu`             | `wevu/jsx-runtime`             | 中立入口，仅包含已声明的全局组件，不包含任何平台原生标签                      |
| `wevu/weapp`       | `wevu/weapp/jsx-runtime`       | 微信小程序原生标签，类型映射为 `WeappIntrinsicElements`                       |
| `wevu/alipay`      | `wevu/alipay/jsx-runtime`      | 支付宝小程序原生标签，类型映射为 `AlipayIntrinsicElements`                    |
| `wevu/tt`          | `wevu/tt/jsx-runtime`          | 抖音小程序原生标签，类型映射为 `TtIntrinsicElements`                          |
| `wevu/miniprogram` | `wevu/miniprogram/jsx-runtime` | 微信、支付宝和抖音三端严格公共子集，类型映射为 `MiniProgramIntrinsicElements` |

每个平台入口只拥有自己的原生标签映射，不从宿主 API 类型包借用 `IntrinsicElements`。`wevu/miniprogram` 也不是三端类型的联合：标签、属性和枚举值必须同时存在且兼容才会进入公共映射，因此适合约束真正可移植的源码。

这些映射只接受已建模的标签和属性。事件使用 JSX 编译器识别的源码拼写，例如 `onTap`，而不是宿主模板中的 `bindtap`；编译器不支持的 HTML 别名也不会被类型入口放行。

微信 `worklet:*` 命名属性目前不会进入 JSX 类型映射，因为 Wevu JSX 编译器尚不支持命名属性；类型声明不会把它们伪装成普通 `on*` 事件。

## 配置与选择规则

Weapp-vite 生成受管 TypeScript 配置时，会保持 `jsx: "preserve"`。只有项目声明了 `wevu` 依赖，才会按目标平台选择 `wevu/weapp`、`wevu/alipay` 或 `wevu/tt`；未建模的平台使用中立的 `wevu`，不会静默获得微信标签类型。

用户显式配置的 `weapp.typescript.app.compilerOptions.jsxImportSource` 优先级更高。需要三端可移植约束时，应明确覆盖为 `wevu/miniprogram`，它不会被自动当作未知平台的后备类型。

### 微信小程序

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "wevu/weapp"
  }
}
```

```tsx
const content = <view className="panel" onTap={() => {}}>微信</view>
```

### 支付宝小程序

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "wevu/alipay"
  }
}
```

```tsx
const content = <input controlled type="numberpad" onInput={() => {}} />
```

### 抖音小程序

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "wevu/tt"
  }
}
```

```tsx
const content = <button open-type="openAwemeUserProfile">打开主页</button>
```

### 三端公共源码

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "wevu/miniprogram"
  }
}
```

```tsx
const content = <button size="mini" type="primary" onTap={() => {}}>提交</button>
```

公共入口会拒绝只属于某一平台的标签、属性或枚举值。若目标平台尚未建模，请使用中立入口：

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "wevu"
  }
}
```

此时已声明的全局组件仍有类型，`<view>` 等平台原生标签则不会被假定为微信类型。目标宿主 API 类型缺失时也应直接暴露对应的类型依赖错误，不能回退到微信类型。

## 公开类型

中立入口 `wevu/jsx-runtime` 导出：

- `WevuJsxChild`
- `WevuJsxElement`
- `WevuJsxEventHandler`
- `WevuJsxHostAttributes`
- `WevuJsxGlobalComponents`
- 中立的 `JSX` 命名空间

`WevuJsxHostAttributes` 只包含明确支持的公共属性和 `data-*` 属性，不提供任意字符串属性逃生口。`WevuJsxGlobalComponents` 可由生成的全局组件声明扩展；中立 `JSX.IntrinsicElements` 只由这些具名组件组成。

平台映射分别从所属入口导入：

```ts
import type { AlipayIntrinsicElements } from 'wevu/alipay/jsx-runtime'
import type { MiniProgramIntrinsicElements } from 'wevu/miniprogram/jsx-runtime'
import type { TtIntrinsicElements } from 'wevu/tt/jsx-runtime'
import type { WeappIntrinsicElements } from 'wevu/weapp/jsx-runtime'
```

## 从旧类型入口迁移

1. 如果原先用 `jsxImportSource: "wevu"` 获取微信原生标签，改为目标平台前缀；跨三端源码则显式改为 `wevu/miniprogram`。
2. 把从 `wevu` 根入口导入的旧平台 intrinsic 类型，改为从上面的所属 `/jsx-runtime` 子路径导入。根入口不再兼容转出这些类型。
3. 把 `bindtap` 等宿主模板属性改为 JSX 源码属性，例如 `onTap`。
4. 删除依赖任意标签、任意属性或 HTML 标签别名的宽松声明，改用真实小程序标签和已建模属性。

业务运行时 API 仍从 `wevu` 等对应业务入口导入；五个 JSX 类型入口不应作为运行时模块导入。

## 相关页面

- [Core API](/wevu/api/core)
