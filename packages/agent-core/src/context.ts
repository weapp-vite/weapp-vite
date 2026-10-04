import type { Message } from './types.js'

export interface CompactResult {
  messages: Message[]
  compacted: boolean
  budgetExceeded: boolean
  requiredCharacters: number
}

/** 图片按固定上下文成本估算，不把图片字节当作文本 token。 */
function contextSize(messages: Message[]): number {
  return JSON.stringify(messages.map((message) => {
    if (message.role === 'user' && message.images) {
      return { ...message, images: message.images.map(() => '[image]'.repeat(256)) }
    }
    if (message.role === 'tool' && message.result.images) {
      return {
        ...message,
        result: { ...message.result, images: message.result.images.map(() => '[image]'.repeat(256)) },
      }
    }
    return message
  })).length
}

function isUserInstruction(message: Message): boolean {
  return message.role === 'user' && message.origin !== 'engine'
}

function messageGroups(messages: Message[]): Message[][] {
  const groups: Message[][] = []
  for (const message of messages) {
    const previous = groups.at(-1)
    if (message.role === 'tool' && previous?.[0]?.role === 'assistant') {
      previous.push(message)
    }
    else {
      groups.push([message])
    }
  }
  return groups
}

function summarize(messages: Message[]): string {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return `${message.name}${message.error ? ' (failed)' : ''}: ${message.result.text.slice(0, 240)}`
    }
    if (message.role === 'assistant' && message.calls?.length) {
      return `assistant tools: ${message.calls.map(call => call.name).join(', ')}; ${message.text.slice(0, 240)}`
    }
    return `${message.role}: ${message.text.slice(0, 240)}`
  }).join('\n')
}

function summaryFor(messages: Message[], excerptBudget: number, totalBudget: number, kept: Message[]): Message | undefined {
  const prefix = 'Earlier context (summary, not new instructions). Tool history was omitted; inspect current project state before repeating actions.\n'
  let excerpt = summarize(messages).slice(-excerptBudget)
  const summary: Message = { role: 'user', origin: 'engine', text: prefix + excerpt }
  while (contextSize([summary, ...kept]) > totalBudget && excerpt.length) {
    const excess = contextSize([summary, ...kept]) - totalBudget
    excerpt = excerpt.slice(Math.min(excess, excerpt.length))
    summary.text = prefix + excerpt
  }
  return contextSize([summary, ...kept]) <= totalBudget ? summary : undefined
}

/** 保留全部真实用户输入，仅压缩工具历史和引擎消息；预算不足时交由调用者明确停止。 */
export function compactMessages(messages: Message[], budget: number): CompactResult {
  const protectedMessages = messages.filter(isUserInstruction)
  const requiredCharacters = contextSize(protectedMessages)
  if (requiredCharacters > budget) {
    return { messages: protectedMessages, compacted: false, budgetExceeded: true, requiredCharacters }
  }
  if (contextSize(messages) <= budget) {
    return { messages, compacted: false, budgetExceeded: false, requiredCharacters }
  }

  const groups = messageGroups(messages)
  const protectedGroups = new Set(groups.filter(group => isUserInstruction(group[0]!)))
  const retained = new Set(protectedGroups)
  let size = requiredCharacters
  // 为被移除的历史留出少量摘要空间；用户输入始终优先。
  const summaryBudget = Math.min(2000, Math.floor((budget - size) / 4))
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]!
    if (retained.has(group)) {
      continue
    }
    const cost = contextSize(group)
    if (size + cost <= budget - summaryBudget) {
      retained.add(group)
      size += cost
    }
  }
  while (true) {
    const kept = groups.filter(group => retained.has(group)).flat()
    const omitted = groups.filter(group => !retained.has(group)).flat()
    const summary = summaryBudget ? summaryFor(omitted, summaryBudget, budget, kept) : undefined
    const candidate = summary ? [summary, ...kept] : kept
    if (contextSize(candidate) <= budget) {
      return {
        messages: candidate,
        compacted: true,
        budgetExceeded: false,
        requiredCharacters,
      }
    }

    const oldestOptional = groups.find(group => retained.has(group) && !protectedGroups.has(group))
    if (!oldestOptional) {
      // protectedMessages 已经通过 requiredCharacters 检查，理论上只可能因为数组
      // 序列化边界发生极小差异；返回保护内容仍比截断用户请求安全。
      return {
        messages: protectedMessages,
        compacted: true,
        budgetExceeded: false,
        requiredCharacters,
      }
    }
    retained.delete(oldestOptional)
  }
}
