interface McpCheckpoint {
  key: string
  title: string
  tool: string
  expected: string
}

interface CommandItem {
  name: string
  command: string
}

Page({
  data: {
    title: 'MCP AI 调用测试场',
    description: '用于验证 AI 是否能通过 weapp-vite MCP 完成发现、执行与结果校验。',
    checkpoints: [
      {
        key: 'catalog',
        title: '读取能力目录',
        tool: 'workspace_catalog',
        expected: '返回 weapp-vite / wevu / wevu-compiler 的包信息。',
      },
      {
        key: 'search',
        title: '检索项目代码',
        tool: 'run_repo_command (rg)',
        expected: '能定位 apps/mcp-demo/src/pages/index/index.ts。',
      },
      {
        key: 'build',
        title: '执行构建命令',
        tool: 'run_weapp_vite_cli',
        expected: '构建 apps/mcp-demo 成功并输出到 dist。',
      },
      {
        key: 'verify',
        title: '校验构建结果',
        tool: 'run_repo_command (node)',
        expected: '运行 scripts/mcp-smoke.mjs 输出 pass。',
      },
    ] as McpCheckpoint[],
    commands: [
      {
        name: '启动 MCP（stdio）',
        command: 'pnpm --filter mcp-demo run mcp:stdio',
      },
      {
        name: '启动 MCP（http）',
        command: 'pnpm --filter mcp-demo run mcp:http',
      },
      {
        name: '执行构建 + 冒烟',
        command: 'pnpm --filter mcp-demo run mcp:smoke',
      },
    ] as CommandItem[],
    promptText: [
      '你现在连接的是 weapp-vite MCP，请对 apps/mcp-demo 做一次完整验证：',
      '1. 调用 workspace_catalog，确认 MCP 服务可用。',
      '2. 用 run_repo_command 执行 rg，定位 apps/mcp-demo/src/pages/index/index.ts。',
      '3. 用 run_weapp_vite_cli 执行 build，目标项目是 apps/mcp-demo。',
      '4. 用 run_repo_command 检查 dist/pages/index/index.wxml 是否存在。',
      '5. 汇总：执行过的工具、关键输出、最终结论（pass/fail）。',
    ].join('\n'),
    tapCounter: 0,
    lastActionAt: '',
  },

  onLoad() {
    this.updateActionTime('页面已加载')
  },

  onTapCounter() {
    this.setData({
      tapCounter: this.data.tapCounter + 1,
    })
    this.updateActionTime('点击了计数按钮')
  },

  async onCopyCommand(event: WechatMiniprogram.CustomEvent<{ command: string }>) {
    const command = event.currentTarget.dataset.command
    if (!command) {
      return
    }

    await this.copyToClipboard(command)
    this.updateActionTime('已复制命令')
  },

  async onCopyPrompt() {
    await this.copyToClipboard(this.data.promptText)
    this.updateActionTime('已复制提示词')
  },

  updateActionTime(action: string) {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')

    this.setData({
      lastActionAt: `${action}（${hh}:${mm}:${ss}）`,
    })
  },

  async copyToClipboard(text: string) {
    try {
      await wx.setClipboardData({ data: text })
      wx.showToast({
        title: '已复制',
        icon: 'success',
        duration: 1200,
      })
    }
    catch {
      wx.showToast({
        title: '复制失败',
        icon: 'none',
      })
    }
  },
})
