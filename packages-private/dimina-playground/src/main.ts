import './style.css'

const base = import.meta.env.BASE_URL
const params = new URLSearchParams(location.search)
const example = params.get('example') ?? 'native'
const status = document.querySelector<HTMLElement>('#status')!
const allowed = ['native', 'wevu', 'react']
const sdkUrl = `${base}dimina-sdk/index.js`
const css = document.createElement('link')
css.rel = 'stylesheet'
css.href = `${base}dimina-sdk/index.css`
document.head.append(css)
interface BridgeRequest { event: string, data: unknown, success: (value: unknown) => void, fail: (value: unknown) => void }

async function launch() {
  if (!allowed.includes(example)) {
    throw new Error(`未知示例：${example}`)
  }
  const { createContainer } = await import(/* @vite-ignore */ sdkUrl)
  const container = createContainer({
    mount: document.querySelector('#container'),
    resourceBaseUrl: `${base}miniapps/${example}/`,
    pageFrameUrl: `${base}pageFrame.html`,
    urlSync: false,
    extModules: {
      Playground: ({ event, data, success, fail }: BridgeRequest) => {
        if (event === 'echo') {
          success({ message: '宿主调用成功', data })
        }
        else { fail({ errMsg: 'Playground: unsupported event' }) }
      },
    },
    onAppLaunchError(error: Error) {
      status.textContent = `启动失败：${error.message}`
    },
  })
  await container.openApp({ appId: 'wxb3d842a4a7e3440d', path: 'pages/index/index' })
  if (!status.textContent?.startsWith('启动失败')) {
    status.textContent = `${example} 示例已打开`
  }
}
void launch().catch((error: unknown) => {
  status.textContent = `启动失败：${String(error)}`
})
import.meta.hot?.on('dimina:error', ({ message }: { message: string }) => {
  status.textContent = `构建失败：${message}`
})
