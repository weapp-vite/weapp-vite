import { version } from '../package.json'

export const VERSION = version
/**
 * 源代码支持的 js 文件格式
 */
export const jsExtensions = ['ts', 'js']
/**
 * 源代码支持的 json 文件格式
 */
export const configExtensions = [...jsExtensions.map(x => `json.${x}`), 'json']
/**
 * 源代码支持的 css 文件格式
 */
export const supportedCssLangs = ['wxss', 'scss', 'less', 'sass', 'styl']
/**
 * 源代码支持的 wxml 文件格式
 */
export const templateExtensions = ['wxml', 'html']
