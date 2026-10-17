# @mpcore/test

面向微信小程序编译产物的 runner 无关测试 API。它模拟微信宿主和逻辑 WXML 树，不创建浏览器 DOM，也不计算 CSS layout。

```ts
import { artifactFromProject, createTestProject } from '@mpcore/test'

const project = createTestProject({
  artifact: artifactFromProject(process.cwd()),
})

try {
  const result = await project.renderComponent('components/counter/index', {
    properties: { value: 1 },
    slots: { default: '<text>计数器</text>' },
    events: ['change'],
  })

  await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
  expect(result.emitted('change')).toEqual([{ value: 2 }])
  await result.setProperties({ value: 3 })
  await result.setData({ expanded: true })
  await result.unmount()
}
finally {
  await project.close()
}
```

`renderPage('/pages/index/index')` 挂载页面。组件通过内存宿主页挂载，属性更新复用同一组件实例并保留内部状态；`setData()` 更新组件自身数据。`unmount()` 触发组件卸载而保留测试会话，`close()` 释放整个渲染会话，`project.close()` 关闭项目内全部渲染。

查询支持 text、role、test id、attribute、`within()` 及 `get/query/find/getAll/findAll` 变体，并保留 `$` / `$$` 选择器逃生口。`tap/input/change/blur/trigger` 会等待同步更新和 microtask 稳定后刷新逻辑树。保留的 `within()` 查询共享最新快照，并按原 runtime `nodeId` 确定范围；该 ID 缺失时查询报错，不会按相同 test id 重定位。runtime 可能在条件节点恢复等情况下复用同一路径的 `nodeId`，此时保留的节点和作用域会解析到当前快照中该 ID 对应的节点。

事件需要显式订阅：`events: ['change']` 从挂载阶段开始收集，`on: { change(detail, event) {} }` 同时收集并回调。挂载后可调用 `result.on('change', listener)`，返回取消订阅函数；省略 listener 时只收集。`off()` 取消对应订阅，已收集的 `emitted()` 历史保留。动态订阅复用组件实例。

子组件可按标签名递归替换：

```ts
const result = await project.renderComponent('components/profile/index', {
  usingComponents: {
    'remote-avatar': {
      properties: { label: '' },
      template: '<text>{{label}}</text><slot />',
    },
    'remote-panel': '/components/local-panel/index',
  },
})
```

替换应用于当前渲染中的整个组件依赖树，不修改磁盘编译产物，也不影响同项目的其他渲染。字符串指向替代组件；声明式替身支持 `template`、属性默认值 `properties` 和初始 `data`，默认模板为 `<slot />`。

`toMiniProgramSnapshot(result.screen)` 将 screen、节点或 `page.snapshot()` 转为稳定语义树，保留标签、公开属性、文本、事件类型和子节点，过滤 runtime ID 与作用域标记，事件 handler 名统一显示为 `[handler]`。`mpcoreSnapshotSerializer` 可注册到支持 Jest serializer 协议的 runner；`@mpcore/vitest` 会自动注册。完整诊断快照仍可通过 `page.snapshot()` 获取。

未匹配的网络 mock 会抛错；未捕获运行时异常和 `console.error` 默认令测试失败。可通过 `diagnostics()` 断言 warning，负向 console 测试可显式设置 `failOnConsoleError: false`。宿主请求可通过 `createWxMock()` 显式配置。
