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
}
