export interface TreemapColorStyle {
  itemStyle: { color: string, borderColor: string }
  label: { color: string, show: boolean } & Record<string, unknown>
  upperLabel: { color: string, show: boolean, backgroundColor: string } & Record<string, unknown>
  emphasis: {
    itemStyle: { color: string, borderColor: string }
    label: { color: string, show: boolean }
    upperLabel: { color: string, show: boolean, backgroundColor: string }
  }
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

export function isWevuRuntimeReference(...references: Array<string | undefined>) {
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

export function createTreemapColorStyle(groupKey: string, hue = hashGroupKey(groupKey), saturation = 42): TreemapColorStyle {
  const lightness = 46
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  const textColor = getReadableTextColor(convertHslToRgb(hue, saturation, lightness))
  const borderColor = '#475569'
  return {
    itemStyle: {
      color,
      borderColor,
    },
    label: {
      ...createNodeLabelStyle(textColor),
      show: true,
    },
    upperLabel: {
      ...createNodeLabelStyle(textColor, true),
      backgroundColor: color,
      padding: [0, 4],
      show: true,
    },
    emphasis: {
      itemStyle: {
        color,
        borderColor,
      },
      label: {
        color: textColor,
        show: true,
      },
      upperLabel: {
        color: textColor,
        backgroundColor: color,
        show: true,
      },
    },
  }
}
