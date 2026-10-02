import { cancelRender, continueRender, delayRender, staticFile } from 'remotion'

const handle = delayRender('加载宣传片本地字体', { timeoutInMilliseconds: 60000 })
Promise.all([
  new FontFace('Noto Sans SC', `url(${staticFile('fonts/NotoSansSC.ttf')})`, { weight: '100 900' }).load(),
  new FontFace('JetBrains Mono', `url(${staticFile('fonts/JetBrainsMono.woff2')})`, { weight: '400' }).load(),
]).then((fonts) => {
  for (const font of fonts) {
    document.fonts.add(font)
  }
  continueRender(handle)
}).catch(cancelRender)
