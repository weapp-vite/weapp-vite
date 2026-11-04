export function taroFixtureFiles(legacy: boolean): Record<string, string> {
  const appConfig = { pages: ['pages/index/index'], subPackages: [{ root: 'subpackage', pages: ['detail/index'] }], window: { navigationBarTitleText: 'Template matrix' } }
  const files: Record<string, string> = {
    'app.jsx': legacy
      ? `import Taro, { Component } from '@tarojs/taro'
import Index from './pages/index/index'
class App extends Component {
  config = ${JSON.stringify(appConfig)}
  render() { return <Index /> }
}
Taro.render(<App />, document.getElementById('app'))
`
      : `export default function App({ children }) { return children }
`,
    'components/feature-card.jsx': legacy
      ? `import Taro, { Component } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
export default class FeatureCard extends Component {
  render() { return <View><Text>{this.props.title}</Text>{this.props.children}</View> }
}
`
      : `import React from 'react'
import { View, Text } from '@tarojs/components'
export default function FeatureCard({ title, children }) { return <View><Text>{title}</Text>{children}</View> }
`,
    'pages/index/index.jsx': legacy
      ? `import Taro, { Component } from '@tarojs/taro'
import { View, Text, Button, Input } from '@tarojs/components'
import FeatureCard from '../../components/feature-card'
export default class Index extends Component {
  state = { enabled: true, label: '源码 😀', items: [{ id: 1, text: 'A & B' }, { id: 2, text: '换行\\n文本' }] }
  choose = () => this.setState({ enabled: !this.state.enabled })
  render() {
    const { enabled, label, items } = this.state
    return <View data-label={label}><FeatureCard title={label}><Text>组件 children &amp; 😀</Text>
      {enabled ? items.map((item, index) => <Text key={item.id} onClick={this.choose}>{index}: {item.text}</Text>) : <View>另一分支</View>}
      <Button onClick={this.choose}>选择</Button><Input disabled placeholder='"entity"' />
    </FeatureCard></View>
  }
}
`
      : `import React, { useState } from 'react'
import { View, Text, Button, Input } from '@tarojs/components'
import FeatureCard from '../../components/feature-card'
export default function Index() {
  const [enabled, setEnabled] = useState(true)
  const items = [{ id: 1, text: 'A & B' }, { id: 2, text: '换行\\n文本' }]
  return <View data-label='源码 😀'><FeatureCard title='源码 😀'><Text>组件 children &amp; 😀</Text>
    {enabled ? items.map((item, index) => <Text key={item.id} onClick={() => setEnabled(false)}>{index}: {item.text}</Text>) : <View>另一分支</View>}
    <Button onClick={() => setEnabled(!enabled)}>选择</Button><Input disabled placeholder='"entity"' />
  </FeatureCard></View>
}
`,
    'subpackage/detail/index.jsx': legacy
      ? `import Taro, { Component } from '@tarojs/taro'
import { View } from '@tarojs/components'
export default class Detail extends Component { render() { return <View>分包页面 😀</View> } }
`
      : `import React from 'react'
import { View } from '@tarojs/components'
export default function Detail() { return <View>分包页面 😀</View> }
`,
  }
  if (!legacy) {
    files['app.config.js'] = `export default ${JSON.stringify(appConfig)}\n`
  }
  return files
}
