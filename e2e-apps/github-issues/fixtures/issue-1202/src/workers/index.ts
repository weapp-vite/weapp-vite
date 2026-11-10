import init from '../assets/add.wasm?init'

worker.onMessage(async (message: { left: number, right: number }) => {
  const instance = await init({})
  worker.postMessage({ value: instance.exports.add(message.left, message.right) })
})
