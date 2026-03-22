# weapp-vite-wevu-tailwindcss-tdesign-retail-template

## 1.0.26

### Patch Changes

- 🐛 **为两个 TDesign wevu 模板统一收敛通用反馈节点：默认 layout 现在承载 `t-toast` 与 `t-dialog`，页面与组件通过封装方法触发提示与确认弹窗，同时补充对应的构建级集成测试，避免页面重新各自挂载通用反馈实例。** [`4e55323`](https://github.com/weapp-vite/weapp-vite/commit/4e553235c1a03d9616a965931a30e304004b6ed2) by @sonofmagic

- 🐛 **修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。** [`94320d3`](https://github.com/weapp-vite/weapp-vite/commit/94320d3ec92e3803054e4d8f7dd8e60d7c1f7e12) by @sonofmagic

- 🐛 **增强 `defineOptions` 的类型能力与 Volar 模板绑定识别：`wevu` 现在支持更完整的工厂签名与原生 `properties/data/methods` 类型推导，Volar 插件会把 `defineOptions` 中声明的模板绑定注入到模板类型检查上下文里。同时补齐 retail 模板中相关订单按钮组件的本地类型与交互缺陷，降低脚本侧类型噪音并修复遗漏的方法调用问题。** [`aef4a30`](https://github.com/weapp-vite/weapp-vite/commit/aef4a30c974c566dc181cc7152e04c96d0f6e41e) by @sonofmagic

- 🐛 **将模板中的 Vue SFC 配置从 `<json>` 自定义块统一迁移为 `definePageJson` 与 `defineComponentJson` 等宏指令写法，避免继续生成旧式配置示例。** [`5ba950b`](https://github.com/weapp-vite/weapp-vite/commit/5ba950bfa7918cbe51cec1b6cab8bf5d9f6153a8) by @sonofmagic
- 📦 **Dependencies** [`aef4a30`](https://github.com/weapp-vite/weapp-vite/commit/aef4a30c974c566dc181cc7152e04c96d0f6e41e)
  → `wevu@6.11.2`

## 1.0.25

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.11.1`

## 1.0.24

### Patch Changes

- 🐛 **修复 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 在订单列表与订单详情页的运行时崩溃问题。模板中的订单卡片 relation 回调改为兼容 `children` 提前未初始化的时序，订单按钮栏也补充了 `order`、`goodsList`、`openType` 等空值保护，并去除了与组件属性同名的冗余 data 字段，减少了 DevTools 运行期告警。对应修复会同步影响 `create-weapp-vite` 生成的新零售模板项目。** [`15cb4c4`](https://github.com/weapp-vite/weapp-vite/commit/15cb4c4daf198792d6a98764e875761322238ac3) by @sonofmagic
- 📦 **Dependencies** [`35a6ee0`](https://github.com/weapp-vite/weapp-vite/commit/35a6ee06d7b8fa56435684011cc706ea5bf9f432)
  → `wevu@6.11.0`

## 1.0.23

### Patch Changes

- 📦 **Dependencies** [`602143a`](https://github.com/weapp-vite/weapp-vite/commit/602143a906e2cdb04534cd9238ba7bcb438282c6)
  → `wevu@6.10.2`

## 1.0.22

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.10.1`

## 1.0.21

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.10.0`

## 1.0.20

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.9.1`

## 1.0.19

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.9.0`

## 1.0.18

### Patch Changes

- 🐛 **统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。** [`2eee335`](https://github.com/weapp-vite/weapp-vite/commit/2eee33515a759635285e34104912558556551690) by @sonofmagic
- 📦 **Dependencies** [`319ed39`](https://github.com/weapp-vite/weapp-vite/commit/319ed39e0312bec9ade9008a65d79877c83108a0)
  → `wevu@6.8.0`

## 1.0.17

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.7.7`

## 1.0.16

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.7.6`

## 1.0.15

### Patch Changes

- 📦 **Dependencies** [`7dda40a`](https://github.com/weapp-vite/weapp-vite/commit/7dda40a4f4a9f0f5e76cfdd3a81bf2fbd5c3a163)
  → `wevu@6.7.5`

## 1.0.14

### Patch Changes

- 📦 **Dependencies** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e)
  → `wevu@6.7.4`

## 1.0.13

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.7.3`

## 1.0.12

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.7.2`

## 1.0.11

### Patch Changes

- 📦 **Dependencies** [`8b76120`](https://github.com/weapp-vite/weapp-vite/commit/8b761206940c4e99c1f65b3663898660f448714d)
  → `wevu@6.7.1`

## 1.0.10

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.7.0`

## 1.0.9

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.6.16`

## 1.0.8

### Patch Changes

- 📦 **Dependencies** [`da5b206`](https://github.com/weapp-vite/weapp-vite/commit/da5b20637dda06f67207f36952ef4115005456dd)
  → `wevu@6.6.15`

## 1.0.7

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.6.14`

## 1.0.6

### Patch Changes

- 📦 **Dependencies** [`6742994`](https://github.com/weapp-vite/weapp-vite/commit/6742994ffd0a3c522d1e527e0d90e4863a2d853c)
  → `wevu@6.6.13`

## 1.0.5

### Patch Changes

- 📦 **Dependencies** [`788a4e0`](https://github.com/weapp-vite/weapp-vite/commit/788a4e080a95524207754bd29316a1504c26b195)
  → `wevu@6.6.12`

## 1.0.4

### Patch Changes

- 📦 **Dependencies** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509)
  → `wevu@6.6.11`

## 1.0.3

### Patch Changes

- 📦 **Dependencies** [`b248a4a`](https://github.com/weapp-vite/weapp-vite/commit/b248a4a6e04dc12dd190fa1b29b615191ed3be87)
  → `wevu@6.6.10`

## 1.0.2

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.6.9`

## 1.0.1

### Patch Changes

- 📦 **Dependencies** [`94a3deb`](https://github.com/weapp-vite/weapp-vite/commit/94a3deb91ab05006a54d7562b6262f0e4f7f67de)
  → `wevu@6.6.8`
