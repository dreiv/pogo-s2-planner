// Usage: npm run pack -- 3            (or: npm run pack -- 3 --compress)
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const phase = process.argv[2] ?? 'adhoc'
mkdirSync('.repomix', { recursive: true })

const args = [
  'repomix',
  '--style', 'xml',
  '-o', `.repomix/phase-${phase}.xml`,
  '--no-gitignore',
  '--include',
  'src/**,fixtures/**,docs/**,scripts/**,.github/**,AGENTS.md,README.md,package.json,vite.config.ts,tsconfig*.json,.gitignore,.editorconfig,.gitattributes,.prettierrc*,eslint.config.*,index.html,vitest.config.*',
  '--ignore', 'local-data/**,.repomix/**,package-lock.json,dist/**,temp/**,**/*.png,**/*.svg',
  '--top-files-len', '10',
]
if (process.argv.includes('--compress')) args.push('--compress')

const r = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(r.status ?? 1)
