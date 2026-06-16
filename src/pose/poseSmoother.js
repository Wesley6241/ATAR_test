import * as THREE from 'three'

export function createPoseSmoother(alpha = 0.35) {
  let position = null
  let quaternion = null

  function update(nextPosition, nextQuaternion) {
    if (!position || !quaternion) {
      position = nextPosition.clone()
      quaternion = nextQuaternion.clone()
      return getPose()
    }

    position.lerp(nextPosition, alpha)
    quaternion.slerp(nextQuaternion, alpha)

    return getPose()
  }

  function reset() {
    position = null
    quaternion = null
  }

  function setAlpha(nextAlpha) {
    alpha = nextAlpha
  }

  function getPose() {
    return {
      position: position ? position.clone() : new THREE.Vector3(),
      quaternion: quaternion ? quaternion.clone() : new THREE.Quaternion(),
    }
  }

  return {
    reset,
    setAlpha,
    update,
  }
}
