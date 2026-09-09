import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

export const WEB_API_PLANS = {
  issue448: [{ id: 'initial', route: '/pages/issue-448/index', action: '检查实际 Web API 执行结果和微任务刷新', nodes: [
    text('.issue448-title', 'issue-448 next web runtime globals'),
    ...Object.entries({ encoded: 'QUI=', decoded: 'AB', event: 'tick', custom: 'payload', url: 'fake://abc/123', canParse: 'true', params: 'a=1&a=0&b=2', cookies: '2', json: 'application/json', error: '0:error', microtask: 'flushed' }).map(([key, value]) => text(`#issue448-${key}`, `${key} = ${value}`)),
    { selector: '.issue448-line', count: 18 },
  ] }],
  issue459: [{ id: 'initial', route: '/pages/issue-459/index', action: '检查直接导入 polyfill 的 URL、属性隔离和文本编解码结果', nodes: [
    text('.issue459-title', 'issue-459 web-apis polyfill compatibility'),
    ...Object.entries({ requestUrl: 'https://issue-459.invalid/abc', requestOwnBody: 'false', responseOwnBody: 'false', responseOwnBodyValue: 'false', responseKeys: 'headers,ok,redirected,status,statusText,type,url', textCodec: 'issue-459' }).map(([key, value]) => text(`#issue459-${key}`, `${key} = ${value}`)),
    { selector: '.issue459-line', count: 6 },
  ] }],
  issue804: [{ id: 'initial', route: '/pages/issue-804/index', action: '检查使用 Web runtime 的组件和投影文本', nodes: [
    text('#issue804-title', 'web runtime custom component'),
    text('#issue804-ready', 'ready'),
    { selector: '.issue804-pressable', scope: ['#issue804-pressable'] },
  ] }],
} satisfies Record<string, DomCheckpoint[]>

export const UPLOAD_MODES = ['arraybuffer-init', 'uint8array-init', 'dataview-init', 'blob-init', 'file-init', 'blob-like-init', 'arraybuffer-request', 'blob-request', 'blob-like-request']
const SHA256 = '7403c95a12ed06b1d6f9c38eff2bfb4596fd04df7c3d97cff4caa13becd6fe4c'

export const UPLOAD_CHECKPOINTS: DomCheckpoint[] = [
  { id: 'initial', route: '/pages/issue-448/index', action: '检查上传前的可见状态', nodes: [text('#issue448-upload', 'upload = idle'), text('#issue448-rawFetch', 'rawFetch = idle'), { selector: '.issue448-upload-result', count: 0 }] },
  ...['blob', 'file', 'request'].map(mode => ({ id: `multipart-${mode}`, route: '/pages/issue-448/index', action: `检查 ${mode} multipart 上传的实际服务端元数据`, nodes: [text(`#issue448-multipart-${mode}`, `${mode}-file | downloaded-${mode}.bin | application/octet-stream | 34 | ${SHA256}`), text('#issue448-upload', 'upload = passed'), text('#issue448-read', 'read = arraybuffer')] })),
  ...UPLOAD_MODES.map(mode => ({ id: `raw-${mode}`, route: '/pages/issue-448/index', action: `检查 ${mode} 原始上传的实际大小和摘要`, nodes: [text(`#issue448-raw-${mode}`, `${mode} | 34 | ${SHA256}`), text('#issue448-rawFetch', 'rawFetch = passed')] })),
]
