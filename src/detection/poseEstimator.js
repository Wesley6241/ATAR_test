import { POS } from './arucoCompat'

export function createPoseEstimator({ markerSizeMeters, detectionWidth, focalLengthScale = 1 }) {
  let posit = null
  let lastWidth = 0
  let lastScale = 0

  function ensurePosit(width, scale) {
    if (!posit || width !== lastWidth || scale !== lastScale) {
      posit = new POS.Posit(markerSizeMeters * 1000, width * scale)
      lastWidth = width
      lastScale = scale
    }

    return posit
  }

  function estimate(marker, overrides = {}) {
    const width = overrides.detectionWidth ?? detectionWidth
    const height = overrides.detectionHeight
    const scale = overrides.focalLengthScale ?? focalLengthScale

    if (!marker || !width || !height) {
      return null
    }

    const centeredCorners = marker.corners.map((corner) => ({
      x: corner.x - width / 2,
      y: height / 2 - corner.y,
    }))

    const pose = ensurePosit(width, scale).pose(centeredCorners)

    if (!pose?.bestRotation || !pose?.bestTranslation) {
      return null
    }

    return {
      error: pose.bestError,
      rotation: pose.bestRotation,
      translationMm: pose.bestTranslation,
      centeredCorners,
    }
  }

  function updateConfig(nextConfig = {}) {
    if (nextConfig.detectionWidth) {
      detectionWidth = nextConfig.detectionWidth
    }

    if (nextConfig.focalLengthScale) {
      focalLengthScale = nextConfig.focalLengthScale
    }
  }

  return {
    estimate,
    updateConfig,
  }
}
