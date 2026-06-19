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
  uiLayer: app.querySelector('.ui-layer'),
  debugPanel: app.querySelector('[data-role="debugPanel"]'),
  startScreen: app.querySelector('[data-role="startScreen"]'),
  startButton: app.querySelector('[data-role="startButton"]'),
}

const sceneConfig = await loadSceneConfig()
const xrSupported = await checkXRSupport()
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
  onEnterAR: enterARExperience,
  onReset: handleReset,
  onFocalScaleChange: handleFocalScaleChange,
  onSmoothingChange: handleSmoothingChange,
  xrSupported,
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
let latestScannerPose = null
let xrSession = null
let xrActive = false

elements.startButton.addEventListener('click', startExperience)
window.addEventListener('resize', syncViewport)
syncViewport()
debugPanel.update({
  markerId: null,
  distanceMeters: null,
  fps: null,
  detected: false,
  initialized,
  xrActive,
  status,
})

async function startExperience() {
  if (stream) {
    return
  }

  elements.startButton.disabled = true
  elements.startScreen.hidden = true

  try {
    stream = await startVideoStream(elements.video)
    detector.setSourceSize(elements.video.videoWidth, elements.video.videoHeight)
    poseEstimator = createPoseEstimator({
      markerSizeMeters: sceneConfig.marker.sizeMeters,
      detectionWidth: Math.min(elements.video.videoWidth, 640),
      focalLengthScale,
    })
    syncViewport()
    animationFrame = window.requestAnimationFrame(tick)
  } catch (error) {
    console.error(error)
    elements.startScreen.hidden = false
    elements.startButton.disabled = false
    status = 'LOST'
    debugPanel.update({
      markerId: null,
      distanceMeters: null,
      fps: null,
      detected: false,
      initialized,
      xrActive,
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
      latestScannerPose = clonePose(smoothed)
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
        xrActive,
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
      xrActive,
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
  if (xrSession) {
    xrSession.end()
    return
  }

  smoother.reset()
  lastDetectionTime = 0
  lastDistanceMeters = null
  latestScannerPose = null
  initialized = false
  status = 'SCANNING'
  arScene.setDebugHelpersVisible(true)
  arScene.resetWorldTransform()
  arScene.setWorldVisible(false)
  debugPanel.update({
    markerId: null,
    distanceMeters: null,
    fps,
    detected: false,
    initialized,
    xrActive,
    status,
  })
}

function handleFocalScaleChange(nextValue) {
  focalLengthScale = nextValue
}

function handleSmoothingChange(nextValue) {
  smoother.setAlpha(nextValue)
}

async function enterARExperience() {
  if (!xrSupported || !initialized || !latestScannerPose || xrSession) {
    return
  }

  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: elements.uiLayer },
    })

    xrSession = session
    xrActive = true
    status = 'XR_ACTIVE'
    debugPanel.update({
      markerId: sceneConfig.marker.id,
      distanceMeters: lastDistanceMeters,
      fps,
      detected: false,
      initialized,
      xrActive,
      status,
    })

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = 0
    }

    stopVideoStream(stream)
    stream = null
    elements.video.hidden = true
    elements.overlay.hidden = true

    await arScene.startXRSession(session, latestScannerPose, handleXRSessionEnd)
  } catch (error) {
    console.error(error)
    xrSession = null
    xrActive = false
    status = initialized ? 'INITIALIZED' : 'LOST'
    debugPanel.update({
      markerId: initialized ? sceneConfig.marker.id : null,
      distanceMeters: lastDistanceMeters,
      fps,
      detected: false,
      initialized,
      xrActive,
      status,
    })
  }
}

function handleXRSessionEnd() {
  xrSession = null
  xrActive = false
  lastDetectionTime = 0
  lastDistanceMeters = null
  smoother.reset()
  elements.video.hidden = false
  elements.overlay.hidden = false
  elements.startButton.disabled = false
  elements.startButton.textContent = 'Start camera'
  elements.startScreen.hidden = false
  latestScannerPose = null
  initialized = false
  status = 'SCANNING'
  arScene.setDebugHelpersVisible(true)
  arScene.setWorldVisible(false)
  arScene.resetWorldTransform()
  debugPanel.update({
    markerId: null,
    distanceMeters: null,
    fps,
    detected: false,
    initialized,
    xrActive,
    status,
  })
}

async function checkXRSupport() {
  try {
    return Boolean(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar')))
  } catch {
    return false
  }
}

function clonePose(pose) {
  return {
    position: pose.position.clone(),
    quaternion: pose.quaternion.clone(),
  }
}

window.addEventListener('beforeunload', () => {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame)
  }

  xrSession?.end()
  stopVideoStream(stream)
})
