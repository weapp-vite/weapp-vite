## 实例与上下文访问 API

<WevuApiDocGroup :api-count="2" summary="读取当前 Wevu 实例、setup 上下文和原生小程序实例。" default-open title="实例与上下文访问 API">

### `getCurrentInstance()` {#getcurrentinstance}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['getCurrentInstance']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/setup-context#example-setup-instance)。

- 用途：获取当前运行时实例。
- 源码：`runtime/hooks.ts`。

### `getCurrentSetupContext()` {#getcurrentsetupcontext}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu')['getCurrentSetupContext']`

**运行时说明：** 该 API 运行在 Wevu 的组件作用域内；涉及 hook 或实例上下文时，应在同步 `setup()` 中调用。

**示例：** 见 [本组示例](/wevu/api/setup-context#example-setup-instance)。

- 用途：获取当前 setup context。
- 源码：`runtime/hooks.ts`。

<span id="setup-context-examples"></span>

### 本组示例 {#example-setup-instance}

Wevu 上下文可参与组合逻辑，原生实例只在命令式方法里使用。

```vue
<script setup lang="ts">
import { getCurrentInstance, getCurrentSetupContext, useNativeInstance } from 'wevu'

const instance = getCurrentInstance()
const context = getCurrentSetupContext()
const native = useNativeInstance()

function submit() {
  context?.emit('submit', instance?.setupState)
  native?.triggerEvent('native-submit')
}
</script>
```

</WevuApiDocGroup>
