import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { connectedFrame, echoFrame, tickFrame, webSocketTranscriptFiles, webSocketTranscriptGlobals } from '../test/helpers/webSocketTranscript'

it('renders pending push-only, rejected stale echo and validated current echo states', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(webSocketTranscriptFiles), globals: webSocketTranscriptGlobals })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    let page = session.reLaunch('/pages/index/index')
    page.receiveFrame(connectedFrame)
    page.receiveFrame(tickFrame)
    render()
    expect(preview.querySelector('#status')?.textContent).toBe('waiting')
    expect(preview.querySelector('#echo-stage')?.textContent).toBe('')
    expect(preview.querySelector('#echo-run')?.textContent).toBe('0')
    page.receiveFrame({ ...echoFrame, body: { client: 'native-websocket', run: 1 } })
    render()
    expect(preview.querySelector('#status')?.textContent).toBe('failed')
    expect(preview.querySelector('#error')?.textContent).toBe('WebSocket echo does not match the current request')
    page = session.reLaunch('/pages/index/index')
    page.receiveFrame(connectedFrame)
    page.receiveFrame(tickFrame)
    page.receiveFrame(echoFrame)
    render()
    expect(preview.querySelector('#status')?.textContent).toBe('success')
    expect(preview.querySelector('#echo-stage')?.textContent).toBe('echo')
    expect(preview.querySelector('#echo-run')?.textContent).toBe('2')
    expect(preview.querySelector('#error')).toBeNull()
  }
  finally {
    session.close()
    preview.remove()
  }
})
