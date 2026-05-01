import type { AnalyzeBudgetConfig, AnalyzeSubpackagesResult, ResolvedTheme } from '../types'

const defaultWarningRatio = 0.85
const healthPalettes = {
  light: {
    green: '#8fd3ad',
    yellow: '#ead486',
    red: '#eaa39b',
  },
  dark: {
    green: '#166853',
    yellow: '#75601f',
    red: '#81323a',
  },
} satisfies Record<ResolvedTheme, Record<'green' | 'yellow' | 'red', string>>
const wevuRuntimeRiskScoreLimit = 0.5

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function parseHexColor(color: string) {
  const value = Number.parseInt(color.slice(1), 16)
  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
  }
}

function mixColor(from: string, to: string, ratio: number) {
  const progress = clamp(ratio)
  const fromRgb = Object.values(parseHexColor(from))
  const toRgb = Object.values(parseHexColor(to))
  const mixed = fromRgb.map((channel, index) => Math.round(channel + (toRgb[index] - channel) * progress))
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

function createRiskColor(score: number, theme: ResolvedTheme) {
  const normalizedScore = clamp(score)
  const healthPalette = healthPalettes[theme]
  if (normalizedScore <= 0.5) {
    return mixColor(healthPalette.green, healthPalette.yellow, normalizedScore / 0.5)
  }
  return mixColor(healthPalette.yellow, healthPalette.red, (normalizedScore - 0.5) / 0.5)
}

function createRiskBorderColor(score: number, theme: ResolvedTheme) {
  if (theme === 'dark') {
    if (score >= 0.82) {
      return '#fda4af'
    }
    if (score >= 0.5) {
      return '#fde68a'
    }
    return '#5eead4'
  }
  if (score >= 0.82) {
    return '#c6756f'
  }
  if (score >= 0.5) {
    return '#c3a24d'
  }
  return '#5caf82'
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

function getReadableTextColor(backgroundColor: string) {
  const { red, green, blue } = parseHexColor(backgroundColor)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.56 ? '#17231d' : '#f8fafc'
}

function createRiskLabelStyle(backgroundColor: string, emphasis = false) {
  const color = getReadableTextColor(backgroundColor)
  const isDarkText = color === '#17231d'
  const contrastStyle = emphasis
    ? {
        textBorderWidth: 0,
        textShadowBlur: 1,
        textShadowColor: isDarkText ? 'rgba(255, 255, 255, 0.32)' : 'rgba(15, 23, 42, 0.34)',
      }
    : {
        backgroundColor: isDarkText ? 'rgba(255, 255, 255, 0.58)' : 'rgba(15, 23, 42, 0.46)',
        borderRadius: 3,
        padding: [1, 4],
        textBorderWidth: 0,
      }

  return {
    color,
    ellipsis: '…',
    fontSize: 12,
    fontWeight: emphasis ? 700 : 600,
    lineHeight: 16,
    minMargin: 4,
    overflow: 'truncate',
    ...contrastStyle,
  }
}

export function createRiskNodeStyle(score: number, theme: ResolvedTheme) {
  const color = createRiskColor(score, theme)

  return {
    itemStyle: {
      color,
      borderColor: createRiskBorderColor(score, theme),
    },
    label: createRiskLabelStyle(color),
    upperLabel: createRiskLabelStyle(color, true),
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
