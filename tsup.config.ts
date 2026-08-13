import { defineConfig } from 'tsup'

/**
 * Пакет ставится через npx у постороннего человека, поэтому собирается в один
 * файл и не тянет за собой ничего из монорепозитория: единственная внешняя
 * зависимость — сам SDK протокола.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  // Карта исходников в npm не едет: она вдвое тяжелее кода, а отлаживают его
  // по репозиторию.
  sourcemap: false,
  // Шебанг нужен, чтобы файл запускался как команда после npx.
  banner: { js: '#!/usr/bin/env node' },
})
