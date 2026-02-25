/**
 * Dev runner: npm run dev [wabot]
 * - npm run dev        -> nuxt dev
 * - npm run dev wabot  -> wa-bot dev (apps/wa-bot)
 */
import { spawn } from 'child_process'

const arg = process.argv[2]
if (arg === 'wabot') {
  const child = spawn('npm', ['run', 'dev:wa-bot'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  })
  child.on('exit', (code) => process.exit(code ?? 0))
} else {
  const child = spawn('nuxt', ['dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}
