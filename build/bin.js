#!/usr/bin/env node

import cli from '@magic/cli'
import { run } from './index.js'

const { args } = cli({
  options: ['--in', '--out', '--port', '--prod', '--serve'],
  default: {
    '--in': 'src',
    '--out': 'docs',
    '--port': 8000,
    '--prod': false,
    '--serve': false,
  },
  single: ['--in', '--out', '--port', '--prod', '--serve'],
  help: {
    name: 'gamejam',
    header: 'builds the gamejam game',
    options: {
      '--in': 'src directory',
      '--out': 'dest directory',
      '--port': 'port to serve from',
      '--prod': 'create production build',
      '--serve': 'serve the bundled files',
    },
    example: `
build/bin.js --in src --out docs --port 8000 --prod true
`.trim(),
  },
})

run(args)
