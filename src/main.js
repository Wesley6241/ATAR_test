import './styles/main.css'

import { startVideoStream, stopVideoStream } from './camera/videoStream'
import { createArucoDetector } from './detection/arucoDetector'
import { createPoseEstimator } from './detection/poseEstimator'
import { cameraPoseFromMarkerPose } from './pose/coordinateTransform'
import { createPoseSmoother } from './pose/poseSmoother'
import { createARScene } from './scene/arScene'
import { loadSceneConfig } from './scene/targetLoader'
import { createDebugPanel } from './ui/debugPanel'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="app-shell">
    <video class="video-layer" data-role="video"></video>
    <div class="three-layer" data-role="three"></div>
    <canvas class="overlay-layer" data-role="overlay"></canvas>

    <div class="ui-layer">
      <div class="debug-panel" data-role="debugPanel"></div>
    </div>

    <section class="start-screen" data-role="startScreen">
      <div class="start-card">
        <h1>Sardis AR ArUco MVP</h1>
        <p>
          This page opens the rear camera, scans Marker 10 as the origin, then
          initializes an AR view with Point A and Point B in marker coordinates.
        </p>
        <ul>
          <li>Use Marker 10 as coordinate origin.</li>
          <li>Scan the marker once to initialize AR.</li>
          <li>Point A is red and Point B is green.</li>
        </ul>
        <button class="start-button" data-role="startButton" type="button">Start camera</button>
      </div>
    </section>
  </main>
`

const elements = {
  video: app.querySelector('[data-role="video"]'),
  three: app.querySelector('[data-role="three"]'),
  overlay: app.querySelector('[data-role="overlay"]'),
  debugPanel: app.querySelector('[data-role="debugPanel"]'),
  startScreen: app.querySelector('[data-role="startScreen"]'),
  startButton: app.querySelector('[data-role="startButton"]'),
}

const sceneConfig = await loadSceneConfig()
const arScene = createARScene({
  container: elements.three,
  markerSizeMeters: sceneConfig.marker.sizeMeters,
  targets: sceneConfig.targets,
})
const detector = createArucoDetector({
  overlayCanvas: elements.overlay,
  markerId: sceneConfig.marker.id,
})
const smoother = createPoseSmoother(sceneConfig.calibration.smoothingAlpha)
const debugPanel = createDebugPanel(elements.debugPanel, {
  targetNames: sceneConfig.targets.map((target) => target.name),
  onReset: handleReset,
  onFocalScaleChange: handleFocalScaleChange,
  onSmoothingChange: handleSmoothingChange,
})

let animationFrame = 0
let lastDetectionTime = 0
let stream = null
let focalLengthScale = sceneConfig.calibration.focalLengthScale
let poseEstimator = null
let status = 'SCANNING'
let fpsWindowStart = performance.now()
let framesThisWindow = 0
let fps = 0
let initialized = false
let lastDistanceMeters = null

elements.startButton.addEventListener('click', startExperience)
window.addEventListener('resize', syncViewport)
syncViewport()
debugPanel.update({
  markerId: null,
  distanceMeters: null,
  fps: null,
  detected: false,
  initialized,
  status,
})

async function startExperience() {
  if (stream) {
    return
  }

  try {
    stream = await startVideoStream(elements.video)
    detector.setSourceSize(elements.video.videoWidth, elements.video.videoHeight)
    poseEstimator = createPoseEstimator({
      markerSizeMeters: sceneConfig.marker.sizeMeters,
      detectionWidth: Math.min(elements.video.videoWidth, 640),
      focalLengthScale,
    })
    elements.startScreen.hidden = true
    syncViewport()
    animationFrame = window.requestAnimationFrame(tick)
  } catch (error) {
    console.error(error)
    status = 'LOST'
    debugPanel.update({
      markerId: null,
      distanceMeters: null,
      fps: null,
      detected: false,
      initialized,
      status,
    })
    elements.startButton.textContent = 'Camera failed'
  }
}

function tick(now) {
  animationFrame = window.requestAnimationFrame(tick)

  syncViewport()

  if (elements.video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
    arScene.render()
    return
  }

  const detection = detector.detect(elements.video)
  framesThisWindow += 1

  if (now - fpsWindowStart >= 1000) {
    fps = (framesThisWindow * 1000) / (now - fpsWindowStart)
    fpsWindowStart = now
    framesThisWindow = 0
  }

  if (!poseEstimator) {
    poseEstimator = createPoseEstimator({
      markerSizeMeters: sceneConfig.marker.sizeMeters,
      detectionWidth: detection.detectionWidth,
      focalLengthScale,
    })
  } else {
    poseEstimator.updateConfig({
      detectionWidth: detection.detectionWidth,
      focalLengthScale,
    })
  }

  if (detection.marker) {
    const pose = poseEstimator.estimate(detection.marker, {
      detectionWidth: detection.detectionWidth,
      detectionHeight: detection.detectionHeight,
      focalLengthScale,
    })

    if (pose && pose.error < 10) {
      const cameraPose = cameraPoseFromMarkerPose(pose.rotation, pose.translationMm)
      const smoothed = smoother.update(cameraPose.cameraPosition, cameraPose.cameraQuaternion)
      arScene.setPose(smoothed.position, smoothed.quaternion)

      if (!initialized) {
        initialized = true
        status = 'INITIALIZED'
        arScene.setDebugHelpersVisible(false)
      } else {
        status = 'ACTIVE'
      }

      lastDetectionTime = now
      lastDistanceMeters = cameraPose.distanceMeters
      debugPanel.update({
        markerId: detection.marker.id,
        distanceMeters: cameraPose.distanceMeters,
        fps,
        detected: true,
        initialized,
        status,
      })
    }
  } else if (now - lastDetectionTime > 250) {
    status = initialized ? 'LOST' : 'SCANNING'
    arScene.setWorldVisible(initialized)
    debugPanel.update({
      markerId: initialized ? sceneConfig.marker.id : null,
      distanceMeters: initialized ? lastDistanceMeters : null,
      fps,
      detected: false,
      initialized,
      status,
    })
  }

  arScene.render()
}

function syncViewport() {
  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  detector.setViewportSize(width, height, dpr)
  arScene.resize(width, height, dpr)
}

function handleReset() {
  smoother.reset()
  lastDetectionTime = 0
  lastDistanceMeters = null
  initialized = false
  status = 'SCANNING'
  arScene.setDebugHelpersVisible(true)
  arScene.setWorldVisible(false)
  debugPanel.update({
    markerId: null,
    distanceMeters: null,
    fps,
    detected: false,
    initialized,
    status,
  })
}

function handleFocalScaleChange(nextValue) {
  focalLengthScale = nextValue
}

function handleSmoothingChange(nextValue) {
  smoother.setAlpha(nextValue)
}

window.addEventListener('beforeunload', () => {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame)
  }

  stopVideoStream(stream)
})
