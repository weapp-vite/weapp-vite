export const VERSION = '__VERSION__'
/**
 * 源代码支持的 js 文件格式
 */
export const jsExtensions = ['ts', 'js']
export const scriptExtensions = ['ts', 'js', 'tsx', 'jsx']

/**
 * 源代码支持的 vue 文件格式
 */
export const vueExtensions = ['vue']
/**
 * 源代码支持的 json 文件格式
 */
export const configExtensions = [
  'jsonc',
  'json',
  // 现在这个版本不推荐使用 json.ts 因为这会造成热更新缓慢
  ...jsExtensions.map(x => `json.${x}`),
]
/**
 * 源代码支持的 css 文件格式
 */
export const supportedCssLangs = ['wxss', 'acss', 'css', 'scss', 'less', 'sass', 'styl']
/**
 * 源代码支持的 wxml 文件格式
 */
export const templateExtensions = ['wxml', 'axml', 'html']
