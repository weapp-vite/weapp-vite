# MCP 可见变化演示使用指南

## 1. 使用场景

把本文里的提示词发给已经接入 `weapp-vite` MCP 的 AI 客户端，可以让它对
`apps/tdesign-miniprogram-starter-retail` 执行一次完整的微信开发者工具运行时演示：

| 目标                  | 产物                                        |
| --------------------- | ------------------------------------------- |
| 打开首页并截图        | `.weapp-vite/mcp-before.png`                |
| 切换到底部“购物车”tab | 当前页变为 `pages/cart/index`               |
| 读取可见节点信息      | 输出 `markup`、`styles`、`measure`          |
| 制造可见运行时变化    | 把底部购物车 tab 文本临时改为 `由 MCP 修改` |
| 再次截图              | `.weapp-vite/mcp-after.png`                 |

> **注意**：这个 starter 的 `pages/cart/index` 页面主体在当前演示数据下可能为空，稳定可见区域是自定义
> tabBar。提示词会优先修改自定义 tabBar 的第三项文本，避免依赖不稳定的购物车商品数据。

## 2. 直接复制的提示词

```text
你现在连接的是 weapp-vite MCP，目标应用是 apps/tdesign-miniprogram-starter-retail。

请执行一次可以复现的微信小程序运行时可见变化演示。优先使用 weapp-vite MCP runtime tools；
如果当前客户端没有直接暴露这些 tools，可以通过 run_repo_command 执行同等的 weapp-ide-cli /
automator 操作，但最终要说明使用的是对应 MCP 工具语义。

前置检查：
1. 工作目录以 apps/tdesign-miniprogram-starter-retail 为目标应用。
2. 确认 dist 已存在；如果不存在，先运行 pnpm --filter tdesign-miniprogram-starter-retail build。
3. 确认微信开发者工具已打开目标应用；如果未打开，先运行 pnpm --filter tdesign-miniprogram-starter-retail dev:open。
4. 不要使用普通浏览器截图替代小程序运行时截图。

演示流程：
1. 调用 weapp_devtools_connect，projectPath 使用 apps/tdesign-miniprogram-starter-retail/dist
   或在目标应用目录下使用 dist，并设置 preferOpenedSession=true、preserveProjectRoot=true。
2. 打开 pages/home/home。优先用 weapp_devtools_route，transition=reLaunch，path=pages/home/home。
3. 等待页面稳定后，调用 weapp_devtools_capture，把截图保存到 .weapp-vite/mcp-before.png。
4. 点击底部 tab 的“购物车”。优先用 weapp_runtime_find_nodes 查找 .index--text 或 t-tab-bar-item，
   找到文本为“购物车”的节点后调用 weapp_runtime_tap_node；如果点击能力在当前客户端不可用，
   使用 weapp_devtools_route，transition=switchTab，path=pages/cart/index 作为等价 fallback。
5. 调用 weapp_devtools_active_page，确认 active page 是 pages/cart/index。
6. 在当前页面读取一个稳定可见节点：
   - 优先选择 .index--text[index=2]，它对应底部 tabBar 第三项文本。
   - 读取 markup：weapp_runtime_node_markup。
   - 读取 styles：weapp_runtime_node_styles，至少读取 display、width、height、color、font-size。
   - 读取 measure：weapp_runtime_measure_node。
7. 制造可见运行时变化：
   - 先读取页面 state。若页面 state 有安全展示字段，可以临时 setData 为“由 MCP 修改的演示文本”。
   - 这个 starter 的 cart 页面 state 可能为空，此时请修改自定义 tabBar 的展示字段：
     将第三个 tab 的文本从“购物车”临时改成“由 MCP 修改”。
   - 首选通过组件运行时能力完成：读取 custom-tab-bar 或底部 tabBar 组件 state，再调用
     weapp_runtime_update_component_state，更新 list[2].text。
   - 如果当前 MCP 客户端不能直接拿到 custom-tab-bar 组件实例，可以通过 run_repo_command 在目标应用目录执行
     一个最小 Node ESM 脚本，使用 weapp-ide-cli 的 connectMiniProgram 连接同一个 DevTools 会话，然后执行：
     getCurrentPages()[getCurrentPages().length - 1].getTabBar().setData({ 'list[2].text': '由 MCP 修改' })。
     这个 fallback 只能修改运行时临时状态，不要改源码文件。
8. 再次读取 .index--text[index=2] 的 markup、styles、measure，确认文本已经变为“由 MCP 修改”。
9. 调用 weapp_devtools_capture，把截图保存到 .weapp-vite/mcp-after.png。
10. 校验 .weapp-vite/mcp-before.png 和 .weapp-vite/mcp-after.png 文件存在且哈希不同。

如果需要 fallback Node ESM 脚本，请通过 run_repo_command 执行下面这个命令，不要创建持久源码文件：

node --input-type=module - <<'EOF'
import fs from 'node:fs/promises'
import path from 'node:path'
import { connectMiniProgram } from 'weapp-ide-cli'

const cwd = process.cwd()
const projectPath = path.join(cwd, 'dist')
const beforePath = path.join(cwd, '.weapp-vite', 'mcp-before.png')
const afterPath = path.join(cwd, '.weapp-vite', 'mcp-after.png')
const styleNames = ['display', 'width', 'height', 'color', 'font-size']

async function screenshot(miniProgram, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await miniProgram.screenshot({ path: outputPath, timeout: 60_000 })
}

async function readTabNode(page) {
  const elements = await page.$$('.index--text')
  const element = elements[2] || await page.$('view')
  const styles = Object.fromEntries(await Promise.all(styleNames.map(async name => [
    name,
    await element.style(name).catch(() => null),
  ])))
  return {
    selector: '.index--text[index=2]',
    tagName: element.tagName,
    text: await element.text().catch(() => null),
    markup: await element.outerWxml().catch(() => null),
    styles,
    measure: {
      offset: await element.offset().catch(() => null),
      size: await element.size().catch(() => null),
    },
  }
}

const miniProgram = await connectMiniProgram({
  projectPath,
  preferOpenedSession: true,
  preserveProjectRoot: true,
  timeout: 60_000,
})

try {
  const homePage = await miniProgram.reLaunch('/pages/home/home')
  await homePage.waitFor(3000)
  await screenshot(miniProgram, beforePath)

  const cartPage = await miniProgram.switchTab('/pages/cart/index')
  await cartPage.waitFor(2000)
  const activePage = await miniProgram.currentPage()
  const beforeNode = await readTabNode(activePage)

  const stateChange = await miniProgram.evaluate(() => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    const tabBar = page && page.getTabBar && page.getTabBar()
    if (!tabBar || !tabBar.setData) {
      return { ok: false, reason: 'custom tabBar not found' }
    }
    const before = tabBar.data?.list?.[2]?.text
    tabBar.setData({ 'list[2].text': '由 MCP 修改' })
    return {
      ok: true,
      selector: 'custom-tab-bar',
      key: 'list[2].text',
      before,
      after: tabBar.data?.list?.[2]?.text,
    }
  })

  await activePage.waitFor(800)
  await screenshot(miniProgram, afterPath)
  const afterPage = await miniProgram.currentPage()
  const afterNode = await readTabNode(afterPage)

  console.log(JSON.stringify({
    ok: true,
    currentPagePath: afterPage.path,
    screenshots: {
      before: '.weapp-vite/mcp-before.png',
      after: '.weapp-vite/mcp-after.png',
    },
    beforeNode,
    afterNode,
    stateChange,
  }, null, 2))
}
finally {
  miniProgram.disconnect?.()
}
EOF

最终输出：
1. 用到的 MCP 工具或等价 MCP 工具语义，至少包含：
   weapp_devtools_connect、weapp_devtools_route、weapp_devtools_capture、
   weapp_devtools_active_page、weapp_runtime_find_nodes、weapp_runtime_node_markup、
   weapp_runtime_node_styles、weapp_runtime_measure_node、weapp_runtime_update_component_state
   或 run_repo_command fallback。
2. 截图路径：
   - 变化前：.weapp-vite/mcp-before.png
   - 变化后：.weapp-vite/mcp-after.png
3. 当前页面路径：必须是 pages/cart/index。
4. 节点读取结果：输出修改前后的 text、markup、styles、measure。
5. 截图校验：输出两个文件是否存在，以及哈希是否不同。
6. 是否成功：成功标准是 active page 为 pages/cart/index，且 after 截图中底部第三个 tab 文本显示“由 MCP 修改”。
```

## 3. 成功判定

| 检查项     | 期望结果                                          |
| ---------- | ------------------------------------------------- |
| 当前页面   | `pages/cart/index`                                |
| 修改前截图 | `.weapp-vite/mcp-before.png` 存在                 |
| 修改后截图 | `.weapp-vite/mcp-after.png` 存在                  |
| 可见变化   | 底部第三个 tab 文本从 `购物车` 变成 `由 MCP 修改` |
| 节点读取   | 输出 `markup`、`styles`、`measure`                |
| 截图差异   | 两张 PNG 的哈希不同                               |

## 4. 常见问题

**Q1: 连接微信开发者工具失败怎么办？**

先确认微信开发者工具服务端口已启用，并且当前打开的是
`apps/tdesign-miniprogram-starter-retail/dist`。如果之前跑过其他 E2E、截图或 automator 任务，
先关闭多余的微信开发者工具窗口，再重新执行 `pnpm --filter tdesign-miniprogram-starter-retail dev:open`。

**Q2: 为什么不直接修改 `pages/cart/index` 的页面 state？**

当前演示数据下 `pages/cart/index` 主体可能为空，页面 data 也可能为空。自定义 tabBar 始终可见，
修改第三个 tab 文本更稳定，也不会破坏业务数据。

**Q3: fallback 脚本会改源码吗？**

不会。脚本只连接当前 DevTools 会话并调用运行时 `setData`，修改的是模拟器里的临时状态。
