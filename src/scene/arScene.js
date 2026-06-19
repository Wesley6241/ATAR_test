import * as THREE from 'three'

const TARGET_COLORS = ['#ef4444', '#22c55e', '#3b82f6']
const UNIT_SCALE = new THREE.Vector3(1, 1, 1)

export function createARScene({ container, markerSizeMeters, targets }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.xr.enabled = true

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100)

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x334155, 1.8)
  const directional = new THREE.DirectionalLight(0xffffff, 1.25)
  directional.position.set(2, 3, 1)
  scene.add(hemisphere, directional)

  const worldRoot = new THREE.Group()
  scene.add(worldRoot)

  const debugHelpers = new THREE.Group()
  worldRoot.add(debugHelpers)

  const axesHelper = new THREE.AxesHelper(0.75)
  debugHelpers.add(axesHelper)

  const markerGeometry = new THREE.BoxGeometry(markerSizeMeters, markerSizeMeters, 0.02)
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.14,
    transparent: true,
    wireframe: true,
  })
  const markerCube = new THREE.Mesh(markerGeometry, markerMaterial)
  markerCube.position.z = -0.01
  debugHelpers.add(markerCube)

  const targetObjects = targets.map((target, index) => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 24),
      new THREE.MeshStandardMaterial({
        color: TARGET_COLORS[index % TARGET_COLORS.length],
        emissive: TARGET_COLORS[index % TARGET_COLORS.length],
        emissiveIntensity: 0.2,
        roughness: 0.35,
        metalness: 0.05,
      }),
    )

    sphere.position.set(...target.position)
    sphere.name = target.name
    worldRoot.add(sphere)

    return sphere
  })

  worldRoot.visible = false
  container.appendChild(renderer.domElement)

  let xrInitialCameraPose = null
  let xrAligned = false
  let xrEndHandler = null

  function resize(width, height, dpr) {
    renderer.setPixelRatio(Math.min(dpr, 2))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function setPose(position, quaternion) {
    camera.position.copy(position)
    camera.quaternion.copy(quaternion)
    worldRoot.visible = true
  }

  function setWorldVisible(visible) {
    worldRoot.visible = visible
  }

  function setDebugHelpersVisible(visible) {
    debugHelpers.visible = visible
  }

  function render() {
    alignXRWorldIfNeeded()
    renderer.render(scene, camera)
  }

  async function startXRSession(session, initialCameraPose, onEnd) {
    xrInitialCameraPose = {
      position: initialCameraPose.position.clone(),
      quaternion: initialCameraPose.quaternion.clone(),
    }
    xrAligned = false

    if (xrEndHandler) {
      session.removeEventListener('end', xrEndHandler)
    }

    xrEndHandler = () => {
      renderer.setAnimationLoop(null)
      xrInitialCameraPose = null
      xrAligned = false
      resetWorldTransform()
      onEnd?.()
    }

    session.addEventListener('end', xrEndHandler)
    await renderer.xr.setSession(session)
    renderer.setAnimationLoop(render)
  }

  function resetWorldTransform() {
    worldRoot.position.set(0, 0, 0)
    worldRoot.quaternion.identity()
  }

  function alignXRWorldIfNeeded() {
    if (!renderer.xr.isPresenting || xrAligned || !xrInitialCameraPose) {
      return
    }

    const xrCamera = renderer.xr.getCamera(camera)
    const initialCameraMatrix = new THREE.Matrix4().compose(
      xrInitialCameraPose.position,
      xrInitialCameraPose.quaternion,
      UNIT_SCALE,
    )
    const worldMatrix = new THREE.Matrix4()
      .copy(xrCamera.matrixWorld)
      .multiply(initialCameraMatrix.clone().invert())
    const worldScale = new THREE.Vector3()

    worldMatrix.decompose(worldRoot.position, worldRoot.quaternion, worldScale)
    worldRoot.visible = true
    xrAligned = true
  }

  return {
    camera,
    markerCube,
    resize,
    render,
    resetWorldTransform,
    setDebugHelpersVisible,
    setPose,
    startXRSession,
    setWorldVisible,
    targetObjects,
  }
}
