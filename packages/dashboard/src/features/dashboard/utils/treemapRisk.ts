import type { AnalyzeBudgetConfig, AnalyzeSubpackagesResult } from '../types'

const defaultWarningRatio = 0.85
export type TreemapNodeDepth = 'package' | 'file' | 'leaf'

const depthColorSettings = {
  package: {
    saturation: 50,
    lightness: 34,
  },
  file: {
    saturation: 46,
    lightness: 40,
  },
  leaf: {
    saturation: 42,
    lightness: 46,
  },
} satisfies Record<TreemapNodeDepth, { saturation: number, lightness: number }>
const wevuRuntimeRiskScoreLimit = 0.5
const groupPresentationCache = new Map<string, { color: string, textColor: string }>()

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function hashGroupKey(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const mixed = Math.imul((hash ^ (hash >>> 4)) >>> 0, 3266489909) >>> 0
  return Math.round(((mixed / 0x100000000) * 360 + 247) % 360)
}

function convertHslToRgb(hue: number, saturation: number, lightness: number) {
  const normalizedSaturation = saturation / 100
  const normalizedLightness = lightness / 100
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation
  const hueSegment = hue / 60
  const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1))
  const offset = normalizedLightness - chroma / 2
  const [red, green, blue] = hueSegment < 1
    ? [chroma, secondary, 0]
    : hueSegment < 2
      ? [secondary, chroma, 0]
      : hueSegment < 3
        ? [0, chroma, secondary]
        : hueSegment < 4
          ? [0, secondary, chroma]
          : hueSegment < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  return [red + offset, green + offset, blue + offset]
    .map(channel => Math.round(channel * 255) / 255)
}

function toLinearChannel(channel: number) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function getRelativeLuminance([red, green, blue]: number[]) {
  return 0.2126 * toLinearChannel(red)
    + 0.7152 * toLinearChannel(green)
    + 0.0722 * toLinearChannel(blue)
}

function getContrastRatio(first: number, second: number) {
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

function getReadableTextColor(background: number[]) {
  const backgroundLuminance = getRelativeLuminance(background)
  const lightTextLuminance = getRelativeLuminance([248 / 255, 250 / 255, 252 / 255])
  const darkTextLuminance = getRelativeLuminance([15 / 255, 23 / 255, 42 / 255])
  const lightContrast = getContrastRatio(backgroundLuminance, lightTextLuminance)
  const darkContrast = getContrastRatio(backgroundLuminance, darkTextLuminance)
  if (Math.max(lightContrast, darkContrast) >= 4.5) {
    return lightContrast >= darkContrast ? '#f8fafc' : '#0f172a'
  }
  return getContrastRatio(backgroundLuminance, 1) >= getContrastRatio(backgroundLuminance, 0)
    ? '#ffffff'
    : '#000000'
}

function getGroupPresentation(groupKey: string, depth: TreemapNodeDepth) {
  const cacheKey = `${groupKey}\u0000${depth}`
  const cached = groupPresentationCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const settings = depthColorSettings[depth]
  const hue = hashGroupKey(groupKey)
  const presentation = {
    color: `hsl(${hue}, ${settings.saturation}%, ${settings.lightness}%)`,
    textColor: getReadableTextColor(convertHslToRgb(hue, settings.saturation, settings.lightness)),
  }
  groupPresentationCache.set(cacheKey, presentation)
  return presentation
}

function createRiskBorderColor(score: number) {
  if (score >= 0.82) {
    return '#fb7185'
  }
  if (score >= 0.58) {
    return '#fbbf24'
  }
  return '#475569'
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

function createNodeLabelStyle(textColor: string, emphasis = false) {
  const usesLightText = textColor === '#f8fafc' || textColor === '#ffffff'
  return {
    color: textColor,
    ellipsis: '…',
    fontSize: emphasis ? 12 : 11,
    fontWeight: emphasis ? 650 : 500,
    lineHeight: emphasis ? 17 : 15,
    minMargin: 5,
    overflow: 'truncate',
    textBorderWidth: 0,
    textShadowBlur: usesLightText ? 2 : 0,
    textShadowColor: usesLightText ? 'rgba(0, 0, 0, 0.48)' : 'transparent',
  }
}

export function createTreemapNodeStyle(
  score: number,
  groupKey: string,
  depth: TreemapNodeDepth,
  showLabel = true,
  showUpperLabel = true,
) {
  const { color, textColor } = getGroupPresentation(groupKey, depth)
  const borderColor = createRiskBorderColor(score)
  return {
    itemStyle: {
      color,
      borderColor,
    },
    label: {
      ...createNodeLabelStyle(textColor),
      show: showLabel,
    },
    upperLabel: {
      ...createNodeLabelStyle(textColor, true),
      backgroundColor: color,
      padding: [0, 4],
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
