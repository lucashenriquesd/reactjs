import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    stylex.vite({
      useCSSLayers: true,
      // ... other StyleX configuration options
    }),
    react()
  ],
})
