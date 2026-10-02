import { Composition, registerRoot } from 'remotion'
import { Film } from './film'
import { filmSpecs, fps } from './timeline'

function Root() {
  return (
    <>
      {filmSpecs.map(spec => <Composition key={spec.id} id={spec.id} component={Film} defaultProps={{ portrait: spec.name === 'portrait' }} width={spec.width} height={spec.height} fps={fps} durationInFrames={spec.seconds * fps} />)}
    </>
  )
}

registerRoot(Root)
