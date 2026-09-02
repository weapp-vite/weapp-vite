import type { AnalyzeBudgetConfig, AnalyzeSubpackagesResult, ResolvedTheme } from '../types'

const defaultWarningRatio = 0.85
export type TreemapNodeDepth = 'package' | 'file' | 'leaf'

const depthColorSettings = {
  package: {
    saturation: 48,
    light: 76,
    dark: 24,
  },
  file: {
    saturation: 44,
    light: 82,
    dark: 28,
  },
  leaf: {
    saturation: 40,
    light: 87,
    dark: 31,
  },
} satisfies Record<TreemapNodeDepth, { saturation: number, light: number, dark: number }>
const groupHues = [174, 218, 38, 326, 272, 12, 196, 88] as const
const wevuRuntimeRiskScoreLimit = 0.5

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function createGroupColor(groupIndex: number, theme: ResolvedTheme, depth: TreemapNodeDepth) {
  const settings = depthColorSettings[depth]
  const hue = groupHues[groupIndex % groupHues.length]!
  const lightness = theme === 'dark' ? settings.dark : settings.light
  return `hsl(${hue}, ${settings.saturation}%, ${lightness}%)`
}

function createRiskBorderColor(score: number, theme: ResolvedTheme) {
  if (score >= 0.82) {
    return theme === 'dark' ? '#fb7185' : '#be123c'
  }
  if (score >= 0.58) {
    return theme === 'dark' ? '#fbbf24' : '#a16207'
  }
  return theme === 'dark' ? 'rgba(226, 232, 240, 0.18)' : 'rgba(15, 23, 42, 0.16)'
}

function isWevuRuntimeReference(...references: Array<string | undefined>) {
  return references.some((reference) => {
    if (!reference) {
      return false
    }

    const normalizedReference = reference.replaceAll('\\', '/')
    return normalizedReference.includes('packages-runtime/wevu/')
      || normalizedReference.includes('node_modules/wevu/')
      || normalizedReference.includes('node_modules/@weapp-vite/wevu/')
      || normalizedReference.includes('weapp-vendors/wevu-')
  })
}

function normalizeRuntimeRiskScore(score: number, ...references: Array<string | undefined>) {
  if (isWevuRuntimeReference(...references)) {
    return Math.min(score, wevuRuntimeRiskScoreLimit)
  }
  return score
}

function createNodeLabelStyle(theme: ResolvedTheme, emphasis = false) {
  return {
    color: theme === 'dark' ? '#f8fafc' : '#0f172a',
    ellipsis: '…',
    fontSize: emphasis ? 12 : 11,
    fontWeight: emphasis ? 650 : 500,
    lineHeight: emphasis ? 17 : 15,
    minMargin: 5,
    overflow: 'truncate',
    textBorderWidth: 0,
    textShadowBlur: theme === 'dark' ? 2 : 0,
    textShadowColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.48)' : 'transparent',
  }
}

export function createTreemapNodeStyle(
  score: number,
  theme: ResolvedTheme,
  groupIndex: number,
  depth: TreemapNodeDepth,
  showLabel = true,
  showUpperLabel = true,
) {
  const color = createGroupColor(groupIndex, theme, depth)
  const borderColor = createRiskBorderColor(score, theme)
  return {
    itemStyle: {
      color,
      borderColor,
    },
    label: {
      ...createNodeLabelStyle(theme),
      show: showLabel,
    },
    upperLabel: {
      ...createNodeLabelStyle(theme, true),
      show: showUpperLabel,
    },
    emphasis: {
      itemStyle: {
        color,
        borderColor,
      },
    },
  }
}

export function getPackageLimitBytes(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  budgets: AnalyzeBudgetConfig | undefined,
) {
  if (!budgets) {
    return 0
  }
  if (pkg.type === 'main') {
    return budgets.mainBytes
  }
  if (pkg.type === 'subPackage') {
    return budgets.subPackageBytes
  }
  if (pkg.type === 'independent') {
    return budgets.independentBytes
  }
  return budgets.totalBytes
}

export function createBudgetRiskScore(totalBytes: number, limitBytes: number, warningRatio = defaultWarningRatio) {
  if (limitBytes <= 0) {
    return 0
  }
  const ratio = totalBytes / limitBytes
  if (ratio >= 1) {
    return 1
  }
  if (ratio >= warningRatio) {
    return 0.58 + ((ratio - warningRatio) / Math.max(1 - warningRatio, 0.01)) * 0.32
  }
  return clamp((ratio / warningRatio) * 0.42, 0, 0.42)
}

export function createShareRiskScore(bytes: number, parentBytes: number) {
  if (parentBytes <= 0) {
    return 0
  }
  const ratio = bytes / parentBytes
  if (ratio >= 0.72) {
    return 0.92
  }
  if (ratio >= 0.45) {
    return 0.64 + ((ratio - 0.45) / 0.27) * 0.22
  }
  return clamp(ratio / 0.45 * 0.46, 0, 0.46)
}

export function normalizeTreemapRiskScore(score: number, ...references: Array<string | undefined>) {
  return normalizeRuntimeRiskScore(score, ...references)
}
