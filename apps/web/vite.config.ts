import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Sin `host` fijo, Vite escucha en localhost (IPv4 e IPv6) y el socket de
    // recarga en caliente conecta sin importar cómo resuelva el navegador.
    port: Number(process.env.PORT || 5173),
  },
})
