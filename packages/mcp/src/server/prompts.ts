import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ExposedPackageId } from '../constants'
import { z } from 'zod'

export function registerServerPrompts(
  server: McpServer,
  options: {
    packageIds: ExposedPackageId[]
    packageIdSchema: z.ZodType<ExposedPackageId>
  },
) {
  const { packageIds, packageIdSchema } = options

  server.registerPrompt('plan-weapp-vite-change', {
    title: 'Plan weapp-vite Change',
    description: '根据变更目标生成 weapp-vite / wevu 修改计划提示词',
    argsSchema: {
      objective: z.string().min(1),
      focusPackage: packageIdSchema.optional(),
    },
  }, async ({ objective, focusPackage }) => {
    const targets = focusPackage ? [focusPackage] : packageIds
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '你是 weapp-vite monorepo 维护者，请给出可执行的改造计划。',
              `目标：${objective}`,
              `聚焦包：${targets.join(', ')}`,
              '请包含：影响面、风险点、测试策略、回滚策略。',
            ].join('\n'),
          },
        },
      ],
    }
  })

  server.registerPrompt('debug-wevu-runtime', {
    title: 'Debug wevu Runtime',
    description: '用于定位 wevu runtime 生命周期/响应式问题的标准提示词',
    argsSchema: {
      symptom: z.string().min(1),
    },
  }, async ({ symptom }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '请基于 wevu runtime 代码路径进行分层排查：',
              '1. 复现场景与最小样例',
              '2. 生命周期钩子触发链',
              '3. 响应式与 setData 差量同步链',
              '4. 单测与 e2e 回归补丁',
              `现象：${symptom}`,
            ].join('\n'),
          },
        },
      ],
    }
  })

  server.registerPrompt('inspect-mini-program-page', {
    title: 'Inspect Mini Program Page',
    description: '连接微信开发者工具并检查当前小程序页面的标准流程',
    argsSchema: {
      projectPath: z.string().min(1),
      pagePath: z.string().optional(),
      focus: z.string().optional(),
    },
  }, async ({ projectPath, pagePath, focus }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '请按顺序使用 weapp-vite MCP runtime tools 检查小程序页面：',
              `1. 调用 weapp_devtools_connect，projectPath=${projectPath}`,
              pagePath ? `2. 调用 weapp_devtools_route 跳转到 ${pagePath}` : '2. 调用 weapp_devtools_active_page 确认当前页面',
              '3. 调用 weapp_devtools_capture 获取截图',
              '4. 如需检查结构，优先调用 weapp_runtime_find_node/weapp_runtime_find_nodes，必要时设置 withWxml=true',
              '5. 调用 weapp_devtools_console 检查 console/exception 日志',
              focus ? `关注点：${focus}` : '关注点：页面是否正确渲染、是否存在运行时错误。',
            ].join('\n'),
          },
        },
      ],
    }
  })

  server.registerPrompt('recover-mini-program-connection', {
    title: 'Recover Mini Program Connection',
    description: '恢复微信开发者工具 automator 连接的标准流程',
    argsSchema: {
      projectPath: z.string().min(1),
      lastError: z.string().optional(),
    },
  }, async ({ projectPath, lastError }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '请按顺序恢复 weapp-vite MCP runtime 连接：',
              `1. 调用 weapp_devtools_connect，projectPath=${projectPath}，reconnect=true`,
              '2. 如果仍失败，检查微信开发者工具是否已开启服务端口与自动化测试能力',
              '3. 如果是协议超时，关闭多余 DevTools 窗口后只重试一次',
              '4. 恢复后调用 weapp_devtools_active_page 和 weapp_devtools_console 确认状态',
              lastError ? `上一次错误：${lastError}` : '上一次错误：未提供。',
            ].join('\n'),
          },
        },
      ],
    }
  })
}
