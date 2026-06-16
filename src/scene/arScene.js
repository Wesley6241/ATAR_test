import * as THREE from 'three'

const TARGET_COLORS = ['#ef4444', '#22c55e', '#3b82f6']

export function createARScene({ container, markerSizeMeters, targets }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100)

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x334155, 1.8)
  const directional = new THREE.DirectionalLight(0xffffff, 1.25)
  directional.position.set(2, 3, 1)
  scene.add(hemisphere, directional)

  const worldRoot = new THREE.Group()
  scene.add(worldRoot)

  const axesHelper = new THREE.AxesHelper(0.75)
  worldRoot.add(axesHelper)

  const markerGeometry = new THREE.BoxGeometry(markerSizeMeters, markerSizeMeters, 0.02)
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.14,
    transparent: true,
    wireframe: true,
  })
  const markerCube = new THREE.Mesh(markerGeometry, markerMaterial)
  markerCube.position.z = -0.01
  worldRoot.add(markerCube)

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

  function render() {
    renderer.render(scene, camera)
  }

  return {
    camera,
    markerCube,
    resize,
    render,
    setPose,
    setWorldVisible,
    targetObjects,
  }
}
