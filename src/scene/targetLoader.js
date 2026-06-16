export async function loadSceneConfig() {
  const response = await fetch('/scene.json')

  if (!response.ok) {
    throw new Error(`Failed to load scene.json (${response.status})`)
  }

  return response.json()
}
