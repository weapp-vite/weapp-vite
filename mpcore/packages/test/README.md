# @mpcore/test

面向微信小程序编译产物的 runner 无关测试 API。它模拟微信宿主和逻辑 WXML 树，不创建浏览器 DOM。

```ts
const project = createTestProject({
  artifact: { projectPath: '/path/to/project' },
  host: createWxMock({
    request: { url: '/api/count', response: { data: { count: 1 } } },
  }),
})

const result = await project.renderComponent('components/counter/index', {
  properties: { value: 1 },
  slots: { default: '<text>计数器</text>' },
})

await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
```

查询支持 text、role、test id、attribute、`within()` 及 `get/query/find/getAll/findAll` 变体，并保留 `$` / `$$` 选择器逃生口。`tap/input/change/blur/trigger` 会等待同步更新和 microtask 稳定后刷新逻辑树。

未匹配的网络 mock 会抛错；未捕获运行时异常和 `console.error` 默认令测试失败。可通过 `diagnostics()` 断言 warning，负向 console 测试可显式设置 `failOnConsoleError: false`。

`@mpcore/test` 为真实微信小程序编译产物提供页面和组件单测环境。它模拟微信宿主与逻辑 WXML 树，不提供浏览器 `document` 或 CSS layout。

```ts
import { artifactFromProject, createTestProject } from '@mpcore/test'

const project = createTestProject({
  artifact: artifactFromProject(process.cwd()),
})

const { screen, user } = await project.renderPage('/pages/index/index')
await user.tap(screen.getByRole('button', { name: '增加' }))
expect(screen.getByText('2')).toBeDefined()

await project.close()
```

组件测试通过内存宿主页挂载构建后的组件，不会修改小程序产物。
