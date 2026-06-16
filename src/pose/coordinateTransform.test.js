import test from 'node:test'
import assert from 'node:assert/strict'

import { cameraPoseFromMarkerPose, markerPoseToThreeTransform } from './coordinateTransform.js'

test('marker pose maps POSIT translation into Three.js camera space', () => {
  const transform = markerPoseToThreeTransform(
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [0, 0, 1000],
  )

  assert.equal(transform.position.x, 0)
  assert.equal(transform.position.y, 0)
  assert.equal(transform.position.z, -1)
  assert.equal(transform.distanceMeters, 1)
})

test('camera pose inversion places the camera in front of marker origin', () => {
  const pose = cameraPoseFromMarkerPose(
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [0, 0, 1000],
  )

  assert.ok(Math.abs(pose.cameraPosition.x) < 1e-9)
  assert.ok(Math.abs(pose.cameraPosition.y) < 1e-9)
  assert.ok(Math.abs(pose.cameraPosition.z - 1) < 1e-9)
})
