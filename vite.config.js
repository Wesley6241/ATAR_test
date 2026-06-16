import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: [
      'js-aruco2/src/aruco.js',
      'js-aruco2/src/posit1.js',
    ],
  },
})
