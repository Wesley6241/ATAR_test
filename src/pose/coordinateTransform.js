import * as THREE from 'three'

const EULER_ORDER = 'YXZ'

export function rotationMatrixToEuler(rotation) {
  return new THREE.Euler(
    -Math.asin(-rotation[1][2]),
    -Math.atan2(rotation[0][2], rotation[2][2]),
    Math.atan2(rotation[1][0], rotation[1][1]),
    EULER_ORDER,
  )
}

export function markerPoseToThreeTransform(rotation, translationMm) {
  const quaternion = new THREE.Quaternion().setFromEuler(rotationMatrixToEuler(rotation))
  const position = new THREE.Vector3(
    translationMm[0] / 1000,
    translationMm[1] / 1000,
    -translationMm[2] / 1000,
  )

  return {
    position,
    quaternion,
    distanceMeters: translationMagnitude(translationMm) / 1000,
  }
}

export function cameraPoseFromMarkerPose(rotation, translationMm) {
  const markerPose = markerPoseToThreeTransform(rotation, translationMm)
  const markerMatrix = new THREE.Matrix4().compose(
    markerPose.position,
    markerPose.quaternion,
    new THREE.Vector3(1, 1, 1),
  )

  const cameraMatrix = markerMatrix.clone().invert()
  const cameraPosition = new THREE.Vector3()
  const cameraQuaternion = new THREE.Quaternion()
  const cameraScale = new THREE.Vector3()
  cameraMatrix.decompose(cameraPosition, cameraQuaternion, cameraScale)

  return {
    cameraPosition,
    cameraQuaternion,
    markerPosition: markerPose.position,
    markerQuaternion: markerPose.quaternion,
    distanceMeters: markerPose.distanceMeters,
  }
}

export function translationMagnitude(translationMm) {
  return Math.hypot(translationMm[0], translationMm[1], translationMm[2])
}
