#!/usr/bin/env node
/**
 * generate-distribution.js
 *
 * Genera distribution.json automáticamente a partir de lo que hay en tus
 * carpetas locales mods/ y resourcepacks/ -- calcula sha1 y tamaño de cada
 * archivo y arma la URL de R2 solo. Se acabó editar el JSON a mano.
 *
 * USO:
 *   1. Poné este archivo en la raíz de tu repo (al lado de mods/, resourcepacks/)
 *   2. node generate-distribution.js
 *   3. Revisá el distribution.json que te generó, subí los archivos nuevos/
 *      cambiados a R2 (rclone sync o el dashboard), y pusheá.
 *
 * Requiere Node 18+ (usa fs, path, crypto -- nada para instalar con npm).
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ---------------------------------------------------------------------
// CONFIGURACIÓN -- ajustá esto a tu proyecto
// ---------------------------------------------------------------------

const BASE_URL = 'https://launcher.cobbleumbral.fun'
const MINECRAFT_VERSION = '1.21.1'

// Carpetas locales a escanear (nombre = como queda en el "path" del JSON)
const FOLDERS_TO_SCAN = ['mods', 'resourcepacks']

// Casos especiales: archivos que NO viven en R2 (ej. el Cobblemon.jar de
// 135MB, que se queda en GitHub Releases por ser muy grande). La clave es
// el nombre EXACTO del archivo tal cual está en tu carpeta local.
const URL_OVERRIDES = {
  'Cobblemon-fabric-1.7.3+1.21.1.jar': 'https://github.com/ElmoAwA/Cobbleumbral/releases/download/1.0/Cobblemon-fabric-1.7.3+1.21.1.jar'
}

const OUTPUT_PATH = path.join(__dirname, 'distribution.json')

// ---------------------------------------------------------------------
// No hace falta tocar nada de acá para abajo
// ---------------------------------------------------------------------

function sha1File(filePath) {
  const hash = crypto.createHash('sha1')
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest('hex')
}

function buildUrl(folder, filename) {
  if (URL_OVERRIDES[filename]) return URL_OVERRIDES[filename]
  return `${BASE_URL}/${folder}/${encodeURIComponent(filename)}`
}

function scanFolder(folder) {
  const dirPath = path.join(__dirname, folder)
  if (!fs.existsSync(dirPath)) {
    console.warn(`⚠️  No existe la carpeta "${folder}/", la salteo.`)
    return []
  }

  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    // Ignora archivos ocultos / de sistema típicos
    .filter((name) => !name.startsWith('.') && name !== 'Thumbs.db')

  return entries.map((filename) => {
    const fullPath = path.join(dirPath, filename)
    const stats = fs.statSync(fullPath)
    return {
      name: filename,
      path: `${folder}/`,
      url: buildUrl(folder, filename),
      sha1: sha1File(fullPath),
      size: stats.size,
      type: 'OTHER'
    }
  })
}

function main() {
  console.log('Generando distribution.json...\n')

  let allFiles = []
  let overriddenCount = 0

  for (const folder of FOLDERS_TO_SCAN) {
    const files = scanFolder(folder)
    console.log(`📁 ${folder}/  ->  ${files.length} archivo(s)`)
    for (const f of files) {
      const isOverride = !!URL_OVERRIDES[f.name]
      if (isOverride) overriddenCount++
      const sizeMb = (f.size / 1024 / 1024).toFixed(2)
      console.log(`   ${isOverride ? '🔗' : '  '} ${f.name}  (${sizeMb} MB)${isOverride ? '  [URL manual, no R2]' : ''}`)
    }
    allFiles = allFiles.concat(files)
  }

  if (allFiles.length === 0) {
    console.error('\n❌ No encontré ningún archivo. Revisá que este script esté en la raíz del repo, al lado de mods/ y resourcepacks/.')
    process.exit(1)
  }

  const distribution = {
    version: MINECRAFT_VERSION,
    files: allFiles
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(distribution, null, 2), 'utf-8')

  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0)
  console.log(`\n✅ Listo: ${allFiles.length} archivos (${overriddenCount} con URL manual), ${(totalSize / 1024 / 1024).toFixed(1)} MB totales.`)
  console.log(`   Escrito en: ${OUTPUT_PATH}`)
  console.log('\nRecordá: esto solo arma el JSON. Todavía tenés que subir los archivos nuevos/cambiados a R2 antes de pushear.')
}

main()
