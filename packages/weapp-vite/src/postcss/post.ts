import type { Comment, Node, PluginCreator } from 'postcss'
import type { MpPlatform } from '@/types'
import { cssAtRulePrefix, ENDIF, IFDEF, IFNDEF } from './constants'

interface ConditionalDirective {
  type: 'ifdef' | 'ifndef' | 'endif'
  targets: string[]
}

function normalizeTargets(values: string[]): string[] {
  return values.map(value => value.trim().toLowerCase()).filter(Boolean)
}

function parseDirective(text: string): ConditionalDirective | undefined {
  const normalized = text.replace(/\*/g, '').trim()
  if (!normalized) {
    return undefined
  }
  const [keyword, ...rest] = normalized.split(/\s+/)
  if (!keyword) {
    return undefined
  }

  if (keyword === IFDEF) {
    return {
      type: 'ifdef',
      targets: normalizeTargets(rest),
    }
  }

  if (keyword === IFNDEF) {
    return {
      type: 'ifndef',
      targets: normalizeTargets(rest),
    }
  }

  if (keyword === ENDIF) {
    return {
      type: 'endif',
      targets: [],
    }
  }
  return undefined
}

function removeConditionalBlock(start: Comment) {
  let depth = 1
  let node: Node | undefined | null = start.next()
  while (node && depth > 0) {
    if (node.type === 'comment') {
      const directive = parseDirective((node as Comment).text)
      if (directive) {
        if (directive.type === 'endif') {
          depth -= 1
          const comment = node as Comment
          node = comment.next()
          comment.remove()
          continue
        }
        else {
          depth += 1
          const comment = node as Comment
          node = comment.next()
          comment.remove()
          continue
        }
      }
    }
    const next = node.next()
    node.remove()
    node = next
  }
}

export const postCreator: PluginCreator<{ platform: MpPlatform }> = (options = { platform: 'weapp' }) => {
  const atRulePrefixRegExp = new RegExp(`^${cssAtRulePrefix}-`)
  const platform = options.platform.toLowerCase()

  return {
    postcssPlugin: 'postcss-weapp-vite-plugin-post',
    prepare() {
      return {
        AtRule(atRule) {
          if (!atRulePrefixRegExp.test(atRule.name)) {
            return
          }

          if (atRule.name === `${cssAtRulePrefix}-keep-import`) {
            atRule.name = 'import'
            return
          }

          if (atRule.name === `${cssAtRulePrefix}-if`) {
            const matches = [...atRule.params.matchAll(/\(([^)]+)\)/g)]
            const shouldKeep = matches.some((match) => {
              return match[1].trim() === platform
            })
            if (!shouldKeep) {
              atRule.remove()
            }
            else {
              atRule.replaceWith(atRule.nodes)
            }
          }
        },
        Comment(comment) {
          const directive = parseDirective(comment.text)
          if (!directive) {
            comment.remove()
            return
          }

          if (directive.type === 'endif') {
            comment.remove()
            return
          }

          const targets = directive.targets
          const hasPlatform = targets.includes(platform)

          const shouldKeep = directive.type === 'ifdef'
            ? hasPlatform
            : !hasPlatform

          if (!shouldKeep) {
            removeConditionalBlock(comment)
            comment.remove()
            return
          }

          comment.remove()
        },
      }
    },
  }
}

postCreator.postcss = true
