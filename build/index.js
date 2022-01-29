import path from 'path'
import esbuild from 'esbuild'

import fs from '@magic/fs'
import gss from '@grundstein/gss'

const copyStaticFiles = async ({ inDir, outDir }) => {
  const files = await fs.getFiles(path.join(inDir, 'static'))

  await Promise.all(
    files.map(async file => {
      const content = await fs.readFile(file)

      const outFile = file.replace(path.join(inDir, 'static'), outDir)

      const dirname = path.dirname(outFile)

      await fs.mkdirp(dirname)

      await fs.writeFile(outFile, content)
    }),
  )

  return files
}

export const run = async conf => {
  const inDir = path.join(process.cwd(), conf.in)
  const entry = path.join(inDir, 'index.js')

  const outDir = path.join(process.cwd(), 'docs')
  const outfile = path.join(outDir, 'index.js')

  await fs.rmrf(outDir)

  await fs.mkdirp(outDir)

  const esbuildConfig = {
    entryPoints: [entry],
    bundle: true,
    minify: conf.prod !== false,
    sourcemap: conf.prod === false,
    outfile,
    watch: conf.serve !== false,
  }

  await esbuild.build(esbuildConfig)

  const files = await copyStaticFiles({ inDir, outDir })

  if (conf.serve) {
    gss({ ...conf, dir: outDir })
  }
}
