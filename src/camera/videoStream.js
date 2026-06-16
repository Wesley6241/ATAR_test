const MOBILE_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
}

export async function startVideoStream(videoElement, constraints = MOBILE_CONSTRAINTS) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support camera access.')
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints)

  videoElement.muted = true
  videoElement.autoplay = true
  videoElement.playsInline = true
  videoElement.srcObject = stream

  await videoElement.play()
  await waitForMetadata(videoElement)

  return stream
}

export function stopVideoStream(stream) {
  stream?.getTracks().forEach((track) => track.stop())
}

function waitForMetadata(videoElement) {
  if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    videoElement.onloadedmetadata = () => resolve()
  })
}
