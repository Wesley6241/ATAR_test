import arucoSource from 'js-aruco2/src/aruco.js?raw'
import cvSource from 'js-aruco2/src/cv.js?raw'
import positSource from 'js-aruco2/src/posit1.js?raw'
import svdSource from 'js-aruco2/src/svd.js?raw'

const sourceMap = new Map([
  ['./aruco', arucoSource],
  ['./aruco.js', arucoSource],
  ['./cv', cvSource],
  ['./cv.js', cvSource],
  ['./posit1', positSource],
  ['./posit1.js', positSource],
  ['./svd', svdSource],
  ['./svd.js', svdSource],
])

const cache = new Map()

function loadCommonJsModule(request) {
  if (cache.has(request)) {
    return cache.get(request)
  }

  const source = sourceMap.get(request)

  if (!source) {
    throw new Error(`Unsupported js-aruco2 module request: ${request}`)
  }

  const module = { exports: {} }
  cache.set(request, module.exports)

  const evaluator = new Function(
    'module',
    'exports',
    'require',
    `${source}\nreturn module.exports;`,
  )
  const exports = evaluator.call(module.exports, module, module.exports, loadCommonJsModule)
  cache.set(request, exports)

  return exports
}

export const AR = loadCommonJsModule('./aruco').AR
export const POS = loadCommonJsModule('./posit1').POS

if (!AR || !POS) {
  throw new Error('Failed to load js-aruco2 detector or POSIT modules.')
}
