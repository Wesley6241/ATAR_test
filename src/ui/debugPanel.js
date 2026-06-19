function formatMeters(value) {
  if (value == null || Number.isNaN(value)) {
    return '--'
  }

  return `${value.toFixed(2)} m`
}

function formatFps(value) {
  if (value == null || Number.isNaN(value)) {
    return '--'
  }

  return `${value.toFixed(1)}`
}

export function createDebugPanel(root, { targetNames, onReset, onFocalScaleChange, onSmoothingChange }) {
  root.innerHTML = `
    <div class="status-pill" data-role="statusPill">SCANNING</div>
    <div class="debug-card">
      <div class="debug-grid">
        <div><span class="debug-label">Marker ID</span><strong data-role="markerId">--</strong></div>
        <div><span class="debug-label">Distance</span><strong data-role="distance">--</strong></div>
        <div><span class="debug-label">FPS</span><strong data-role="fps">--</strong></div>
        <div><span class="debug-label">Detection</span><strong data-role="detection">Waiting</strong></div>
        <div><span class="debug-label">Anchor</span><strong data-role="anchor">Not initialized</strong></div>
        <div class="debug-wide"><span class="debug-label">Targets</span><strong data-role="targets"></strong></div>
      </div>

      <label class="control-row">
        <span>Focal scale</span>
        <input data-role="focalScale" type="range" min="0.7" max="1.4" step="0.01" value="1" />
        <output data-role="focalScaleValue">1.00</output>
      </label>

      <label class="control-row">
        <span>Smoothing</span>
        <input data-role="smoothing" type="range" min="0.05" max="0.9" step="0.01" value="0.35" />
        <output data-role="smoothingValue">0.35</output>
      </label>

      <button class="reset-button" data-role="resetButton" type="button">Reset</button>
    </div>
  `

  const refs = {
    statusPill: root.querySelector('[data-role="statusPill"]'),
    markerId: root.querySelector('[data-role="markerId"]'),
    distance: root.querySelector('[data-role="distance"]'),
    fps: root.querySelector('[data-role="fps"]'),
    detection: root.querySelector('[data-role="detection"]'),
    anchor: root.querySelector('[data-role="anchor"]'),
    targets: root.querySelector('[data-role="targets"]'),
    resetButton: root.querySelector('[data-role="resetButton"]'),
    focalScale: root.querySelector('[data-role="focalScale"]'),
    focalScaleValue: root.querySelector('[data-role="focalScaleValue"]'),
    smoothing: root.querySelector('[data-role="smoothing"]'),
    smoothingValue: root.querySelector('[data-role="smoothingValue"]'),
  }

  refs.targets.textContent = targetNames.join(', ')
  refs.resetButton.addEventListener('click', onReset)
  refs.focalScale.addEventListener('input', () => {
    refs.focalScaleValue.textContent = Number(refs.focalScale.value).toFixed(2)
    onFocalScaleChange(Number(refs.focalScale.value))
  })
  refs.smoothing.addEventListener('input', () => {
    refs.smoothingValue.textContent = Number(refs.smoothing.value).toFixed(2)
    onSmoothingChange(Number(refs.smoothing.value))
  })

  function update({ markerId, distanceMeters, fps, detected, initialized, status }) {
    refs.markerId.textContent = markerId ?? '--'
    refs.distance.textContent = formatMeters(distanceMeters)
    refs.fps.textContent = formatFps(fps)
    refs.detection.textContent = detected ? 'Marker 10 detected' : 'Marker 10 not found'
    refs.anchor.textContent = initialized ? 'Initialized from Marker 10' : 'Waiting for Marker 10'
    refs.statusPill.textContent = status
    refs.statusPill.dataset.state = status.toLowerCase()
  }

  return {
    update,
  }
}
