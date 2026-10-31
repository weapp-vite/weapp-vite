const tools = require('./tools.wxs')
const { value: local } = tools
const result = tools['value']
function shadow(tools: { value: number }) {
  return tools.value
}
module.exports = { local, result, shadow }
