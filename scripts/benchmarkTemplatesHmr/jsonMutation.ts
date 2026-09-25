/** 使用宿主支持的展示字段，不把 sitemap 路径改成不存在的文件。 */
export function mutateJsonMarker(source: string, marker: string) {
  const json = JSON.parse(source) as Record<string, unknown>
  const windowOptions = json.window
  if (windowOptions && typeof windowOptions === 'object' && !Array.isArray(windowOptions)
    && typeof (windowOptions as Record<string, unknown>).navigationBarTitleText === 'string') {
    (windowOptions as Record<string, unknown>).navigationBarTitleText = marker
  }
  else if (typeof json.desc === 'string') {
    json.desc = marker
  }
  else if (typeof json.navigationBarTitleText === 'string') {
    json.navigationBarTitleText = marker
  }
  else {
    throw new TypeError('JSON benchmark requires a supported text field (navigationBarTitleText or desc)')
  }
  return `${JSON.stringify(json, null, 2)}\n`
}
