import { AR } from './arucoCompat'

const DEFAULT_MAX_WIDTH = 640

export function createArucoDetector({ overlayCanvas, sourceMaxWidth = DEFAULT_MAX_WIDTH, markerId = 10 }) {
  const overlayContext = overlayCanvas.getContext('2d')
  const detectionCanvas = document.createElement('canvas')
  const detectionContext = detectionCanvas.getContext('2d', { willReadFrequently: true })
  const detector = new AR.Detector({ dictionaryName: 'ARUCO' })

  const state = {
    markerId,
    sourceWidth: 0,
    sourceHeight: 0,
    detectionWidth: 0,
    detectionHeight: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  }

  function setSourceSize(sourceWidth, sourceHeight) {
    if (!sourceWidth || !sourceHeight) {
      return
    }

    state.sourceWidth = sourceWidth
    state.sourceHeight = sourceHeight

    const scale = Math.min(1, sourceMaxWidth / sourceWidth)
    state.detectionWidth = Math.max(1, Math.round(sourceWidth * scale))
    state.detectionHeight = Math.max(1, Math.round(sourceHeight * scale))

    detectionCanvas.width = state.detectionWidth
    detectionCanvas.height = state.detectionHeight
  }

  function setViewportSize(viewportWidth, viewportHeight, dpr) {
    state.viewportWidth = viewportWidth
    state.viewportHeight = viewportHeight

    overlayCanvas.width = Math.max(1, Math.round(viewportWidth * dpr))
    overlayCanvas.height = Math.max(1, Math.round(viewportHeight * dpr))
    overlayCanvas.style.width = `${viewportWidth}px`
    overlayCanvas.style.height = `${viewportHeight}px`

    overlayContext.setTransform(1, 0, 0, 1, 0, 0)
    overlayContext.scale(dpr, dpr)
    overlayContext.lineCap = 'round'
    overlayContext.lineJoin = 'round'
  }

  function detect(videoElement) {
    if (!state.detectionWidth || !state.detectionHeight) {
      setSourceSize(videoElement.videoWidth, videoElement.videoHeight)
    }

    if (!state.detectionWidth || !state.detectionHeight) {
      return emptyResult()
    }

    detectionContext.drawImage(videoElement, 0, 0, state.detectionWidth, state.detectionHeight)
    const imageData = detectionContext.getImageData(0, 0, state.detectionWidth, state.detectionHeight)
    const markers = detector.detect(imageData)
    const marker = markers.find((candidate) => candidate.id === state.markerId) ?? null

    drawOverlay(markers, marker)

    return {
      marker,
      markers,
      detectionWidth: state.detectionWidth,
      detectionHeight: state.detectionHeight,
    }
  }

  function resetOverlay() {
    overlayContext.clearRect(0, 0, state.viewportWidth, state.viewportHeight)
  }

  function drawOverlay(markers, activeMarker) {
    resetOverlay()

    for (const marker of markers) {
      const color = marker === activeMarker ? '#22c55e' : '#ef4444'
      drawMarker(marker, color)
    }
  }

  function drawMarker(marker, strokeStyle) {
    const projectedCorners = marker.corners.map((corner) =>
      projectToViewport(corner.x, corner.y, state.detectionWidth, state.detectionHeight, state.viewportWidth, state.viewportHeight),
    )

    overlayContext.strokeStyle = strokeStyle
    overlayContext.fillStyle = strokeStyle
    overlayContext.lineWidth = 3
    overlayContext.beginPath()

    projectedCorners.forEach((corner, index) => {
      const command = index === 0 ? 'moveTo' : 'lineTo'
      overlayContext[command](corner.x, corner.y)
    })

    overlayContext.closePath()
    overlayContext.stroke()

    overlayContext.fillRect(projectedCorners[0].x - 3, projectedCorners[0].y - 3, 6, 6)

    const minX = Math.min(...projectedCorners.map((corner) => corner.x))
    const minY = Math.min(...projectedCorners.map((corner) => corner.y))
    overlayContext.font = '600 16px ui-monospace, SFMono-Regular, Consolas, monospace'
    overlayContext.fillText(`ID ${marker.id}`, minX, minY - 8)
  }

  return {
    detect,
    resetOverlay,
    setSourceSize,
    setViewportSize,
  }
}

function emptyResult() {
  return {
    marker: null,
    markers: [],
    detectionWidth: 0,
    detectionHeight: 0,
  }
}

function projectToViewport(x, y, sourceWidth, sourceHeight, viewportWidth, viewportHeight) {
  const sourceAspect = sourceWidth / sourceHeight
  const viewportAspect = viewportWidth / viewportHeight

  if (viewportAspect > sourceAspect) {
    const scale = viewportWidth / sourceWidth
    const renderedHeight = sourceHeight * scale
    const offsetY = (viewportHeight - renderedHeight) / 2
    return { x: x * scale, y: y * scale + offsetY }
  }

  const scale = viewportHeight / sourceHeight
  const renderedWidth = sourceWidth * scale
  const offsetX = (viewportWidth - renderedWidth) / 2
  return { x: x * scale + offsetX, y: y * scale }
}
