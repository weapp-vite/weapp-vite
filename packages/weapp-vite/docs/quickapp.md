# QuickApp 实验支持

`weapp-vite` 提供独立的 QuickApp 构建后端，用于两类输入：

1. 原生快应用工程：`manifest.json`、`app.ux`、页面/组件 `.ux`、JavaScript 和静态资源。
2. Vue SFC：把 `.vue` 页面和本地组件直接编译成 QuickApp `.ux`。

该后端不经过小程序 `CompilerContext`，也不属于 `weapp.platform` 或 `MpPlatform`。

## 安装与命令

项目需要显式安装官方 toolkit：

```bash
pnpm add -D hap-toolkit@2.1.0
```

生产构建和开发监听：

```bash
wv build --platform quickapp
wv dev --platform quickapp
```

`hap` 是 `quickapp` 的 CLI 别名。开启官方 toolkit E2E 注入：

```bash
wv build --platform quickapp --quickapp-e2e
wv dev --platform quickapp --quickapp-e2e
```

## 配置

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  quickapp: {
    srcDir: 'src',
    outDir: 'dist/quickapp',
    testDir: 'test',
    toolkit: {
      enabled: true,
      e2e: false,
      devtool: 'source-map',
      args: [],
    },
  },
})
```

- `srcDir`：QuickApp 源码根目录，默认 `src`。
- `outDir`：生成的官方 QuickApp 工程目录，默认 `dist/quickapp`。
- `testDir`：镜像到生成工程的官方 E2E 测试目录，默认 `test`；设为 `false` 可关闭。
- `toolkit.enabled`：是否调用 `hap-toolkit` 校验、编译和生成 RPK，默认 `true`。
- `toolkit.e2e`：是否传递 `--enable-e2e`，也可由 CLI `--quickapp-e2e` 覆盖。
- `toolkit.devtool`：传给 `hap build/watch` 的 sourcemap 配置。
- `toolkit.args`：附加的官方 toolkit 参数。

生成工程和最终 RPK 由 Vite/Rolldown emit/write 与 `hap-toolkit` 负责落盘；后端不会用补写文件的方式伪造最终 bundle。

## Vue SFC 支持范围

当前支持：

- `<script setup>`、TypeScript 去类型、基础 Options API `data()` 和 `methods`。
- `ref`、`reactive`、`computed`、`watch`、`watchEffect`、`nextTick`。
- `onBeforeMount`、`onMounted`、`onBeforeUnmount`、`onUnmounted`、`onActivated`、`onDeactivated`。
- 插值、`v-if`、`v-else-if`、`v-else`、`v-show`、`v-for`、显式 `v-bind` 和 `v-on`。
- 本地 `.vue` 组件导入、props 和自定义事件。
- 普通 `<style>` 内容和 QuickApp 支持的 style lang。

当前不支持：

- `v-model`、动态事件名、事件修饰符、无参数 `v-bind`。
- Web Vue DOM、Transition、Teleport、Suspense 等浏览器运行时能力。
- 把 scoped CSS 当作 Vue Web 的完整等价实现。

遇到不支持的 Vue 模板语法时，编译器会直接报错，不会静默生成行为不确定的 `.ux`。

## 明确不支持微信小程序转换

该后端不会读取或转换以下输入：

- `app.json`、页面 JSON 和 `usingComponents`。
- WXML、WXSS、WXS。
- `wx.*`、`App()`、`Page()`、`Component()`、`setData()`。
- 微信小程序生命周期、事件和组件协议到 QuickApp 的自动映射。

如果项目来源是微信小程序，需要先人工重写为原生 QuickApp 或当前支持范围内的 Vue SFC；不要把 `--platform quickapp` 理解成跨端转换器。

## E2E 分层

仓库使用三层验收：

1. `e2e/ci/quickapp.build.test.ts`：运行真实 CLI 与 `hap-toolkit`，断言原生源码、Vue `.ux`、官方测试镜像、编译目录和 RPK。
2. `e2e-apps/quickapp-runtime-e2e/test/**`：通过 `--quickapp-e2e` 注入的官方 VM 测试，覆盖状态、生命周期、列表、Options API 和系统 API。
3. `pnpm e2e:quickapp`：一次启动 `hap runapp`，通过 ADB deep link、`uiautomator` 文本树和坐标点击验证 Android 模拟器/真机上的原生与 Vue 路由。

设备 E2E 前提：

- 一个在线 ADB 设备；多设备时用 `WEAPP_VITE_QUICKAPP_DEVICE` 指定 serial。
- 已安装官方 `org.hapjs.mockup` 和 `org.hapjs.debugger`。
- debugger 已开启 USB 调试并完成首次连接授权。
- ADB 不在 `PATH` 时，通过 `WEAPP_VITE_QUICKAPP_ADB` 指定可执行文件。

运行：

```bash
pnpm e2e:quickapp
```

设备 suite 独立于微信 DevTools automator provider，不能通过 `WEAPP_VITE_E2E_RUNTIME_PROVIDER` 切换成 QuickApp。
