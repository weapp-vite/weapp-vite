import camelCase from 'camelcase'

const issue769NpmMarker = camelCase('issue 769 sourcemap marker')

Page({
  data: {
    issue769NpmMarker,
    title: 'issue-769 native sourcemap',
  },
  _runE2E() {
    return {
      issue769NpmMarker,
      ok: issue769NpmMarker === 'issue769SourcemapMarker',
    }
  },
})
