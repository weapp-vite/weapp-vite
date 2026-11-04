import type { CorpusSelection, CorpusTextFile } from '../types'
import type { GitTreeEntry } from './github'

const aliases: Record<string, string[]> = {
  weapp: ['mp-weixin', 'weapp', 'wechat', 'weixin'],
  alipay: ['mp-alipay', 'alipay', 'ali'],
  swan: ['mp-baidu', 'swan', 'baidu'],
  tt: ['mp-toutiao', 'toutiao', 'bytedance', 'tt'],
  jd: ['mp-jd', 'jingdong', 'jd'],
  xhs: ['mp-xhs', 'xiaohongshu', 'xhs'],
  qq: ['mp-qq', 'qq'],
  ks: ['mp-kuaishou', 'kuaishou', 'ks'],
  ty: ['mp-tuya', 'tuya', 'ty'],
  taobao: ['mp-taobao', 'taobao'],
  dd: ['mp-dingtalk', 'dingtalk', 'dingding'],
  lark: ['mp-lark', 'lark', 'feishu'],
  quickapp: ['quickapp-native', 'quickapp-webview', 'quickapp', 'hap'],
  harmony: ['mp-harmony', 'harmony'],
}

const labels: Record<string, RegExp> = {
  weapp: /微信小程序|wechat mini(?:program| program)|weixin mini(?:program| program)/i,
  alipay: /支付宝小程序|alipay mini(?:program| program)|alipay/i,
  swan: /百度小程序|百度智能小程序|baidu smart/i,
  tt: /抖音小程序|字节跳动小程序|头条小程序|bytedance mini/i,
  jd: /京东小程序|jingdong mini/i,
  xhs: /小红书小程序|xiaohongshu mini/i,
  qq: /qq\s*小程序|qq\s*mini(?:program| program)/i,
  ks: /快手小程序|kuaishou mini/i,
  ty: /涂鸦小程序|tuya mini/i,
  taobao: /淘宝小程序|淘宝小部件|taobao mini/i,
  dd: /钉钉小程序|dingtalk mini/i,
  lark: /飞书小程序|lark mini|feishu mini/i,
  quickapp: /快应用|quick\s*app/i,
  harmony: /鸿蒙.*(?:模板|小程序)|harmony/i,
}

const markup: Record<string, RegExp> = {
  weapp: /\bwx:[\w-]+\s*=/,
  alipay: /\ba:[\w-]+\s*=/,
  swan: /\bs-(?:if|elif|else|for|key)\b/,
  tt: /\btt:[\w-]+\s*=/,
  jd: /\bjd:[\w-]+\s*=|<jds\b/,
  xhs: /\bxhs:[\w-]+\s*=/,
  qq: /\bqq:[\w-]+\s*=|<qs\b/,
  ks: /\bks:[\w-]+\s*=|<ks\b/,
  ty: /\bty:[\w-]+\s*=/,
}

const styleExtensions: Record<string, string> = { weapp: '.wxss', alipay: '.acss', tt: '.ttss', jd: '.jxss', xhs: '.xhss', qq: '.qss', ks: '.css', ty: '.tyss' }
const ambiguous: Record<string, string[]> = { alipay: ['alipay', 'taobao', 'dd'], taobao: ['alipay', 'taobao', 'dd'], dd: ['alipay', 'taobao', 'dd'], tt: ['tt', 'lark'], lark: ['tt', 'lark'] }

function inDirectory(file: string, platform: string): boolean {
  return (aliases[platform] ?? [platform]).some(alias => file.toLowerCase().split('/').slice(0, -1).includes(alias))
}

function hasBuildTarget(text: string, platform: string): boolean {
  return (aliases[platform] ?? [platform]).some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:--(?:type|platform|mode)[=\\s]+["']?|(?:platform|mode|target|UNI_PLATFORM|TARO_ENV)["']?\\s*[:=]\\s*["']|["'](?:build|dev):)${escaped}(?=[\\s"';:]|$)`, 'i').test(text)
  })
}

function explicitProject(file: CorpusTextFile, platform: string): boolean {
  const basename = file.path.split('/').at(-1)!.toLowerCase()
  if ((aliases[platform] ?? [platform]).some(alias => basename === `project.${alias}.json` || basename === `${alias}.project.json`)) {
    return true
  }
  if (!/project.*\.json$/.test(basename)) {
    return false
  }
  const prefix = platform === 'weapp' ? 'wx[\\da-f]+' : platform === 'tt' ? 'tt[\\da-f]+' : platform === 'lark' ? 'cli_[\\da-z]+' : undefined
  return Boolean(prefix && new RegExp(`["']app(?:id|Id)["']\\s*:\\s*["']${prefix}["']`).test(file.text))
}

/** 优先读取平台配置与根说明，数量有界且仍保留实际读取的文本和哈希。 */
export function identityEvidencePaths(selections: readonly CorpusSelection[], files: readonly GitTreeEntry[]): string[] {
  const configured = new Set(selections.flatMap(selection => selection.evidence))
  const candidates = files.filter(file => file.type === 'blob' && file.mode !== '120000' && (configured.has(file.path)
    || /(?:^|\/)(?:project[.\w-]*\.json|mini\.project\.json|manifest\.json|(?:taro|mpx|uni)[.\w-]*config\.[cm]?[jt]s)$/i.test(file.path)
    || /^readme(?:[._-][\w-]+)?\.md$/i.test(file.path)))
  const priority = (file: string) => /project.*\.json$/.test(file) ? 0 : /^readme/i.test(file) ? 1 : /config\.|manifest\.json/.test(file) ? 2 : /package\.json$/.test(file) ? 3 : 4
  return candidates.sort((a, b) => priority(a.path) - priority(b.path) || a.path.length - b.path.length || a.path.localeCompare(b.path, 'en')).slice(0, 16).map(file => file.path)
}

export interface IdentityDecision {
  confirmed: boolean
  evidence: string[]
}

/** 平台身份由冻结配置、目录和原生语法联合确认，不能只凭模板后缀。 */
export function confirmTemplateIdentity(selection: CorpusSelection, file: string, source: string, files: readonly GitTreeEntry[], evidence: readonly CorpusTextFile[]): IdentityDecision {
  const platform = selection.platform
  const tagged = markup[platform]?.test(source) ?? false
  const templateMarkup = /<[a-z_][\w:.-]*(?:\s|\/?>)/i.test(source)
  const stem = file.slice(0, file.lastIndexOf('.'))
  const styled = files.some(candidate => candidate.type === 'blob' && candidate.path === `${stem}${styleExtensions[platform]}`)
  const miniConfig = evidence.some(item => /(?:^|\/)app\.json$/.test(item.path) && /["'](?:pages|window|usingComponents)["']\s*:/.test(item.text))
  const targets = evidence.filter(item => hasBuildTarget(item.text, platform) || explicitProject(item, platform))
  const declarations = evidence.filter(item => /\.md$/i.test(item.path) && labels[platform]?.test(item.text))
  const projectConfirmed = targets.length > 0 || declarations.length > 0
  const directory = inDirectory(file, platform)
  const competing = (ambiguous[platform] ?? []).filter(candidate => candidate !== platform).some(candidate => evidence.some(item => hasBuildTarget(item.text, candidate) || explicitProject(item, candidate) || (/\.md$/i.test(item.path) && labels[candidate]?.test(item.text))))
  const trace = [
    ...targets.map(item => `platform-config:${item.path}:${item.sha256}`),
    ...declarations.map(item => `platform-declaration:${item.path}:${item.sha256}`),
    ...(directory ? [`platform-directory:${platform}`] : []),
    ...(tagged ? [`platform-syntax:${platform}`] : []),
    ...(styled ? [`platform-style-sidecar:${styleExtensions[platform]}`] : []),
  ]
  const qqSidecar = files.some(candidate => candidate.type === 'blob' && (candidate.path === `${stem}.js` || candidate.path === `${stem}.ts`))
  const qqProject = targets.length > 0 && miniConfig && qqSidecar
  if (platform === 'qq' && !templateMarkup && !qqProject) {
    return { confirmed: false, evidence: ['qml-without-mini-program-markup', ...trace] }
  }
  if (ambiguous[platform]) {
    const scoped = directory && (projectConfirmed || ((tagged || styled) && templateMarkup))
    const unambiguous = !competing && projectConfirmed
    return { confirmed: scoped || unambiguous, evidence: trace }
  }
  const uniqueNativeSyntax = tagged && !['qq', 'ty', 'ks'].includes(platform)
  const confirmed = uniqueNativeSyntax || projectConfirmed || qqProject
    || (directory && (tagged || styled) && templateMarkup) || (platform === 'weapp' && styled && miniConfig)
  return { confirmed, evidence: trace }
}
