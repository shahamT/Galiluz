import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { matchCrawlerEvent, MATCH_SIMILARITY_THRESHOLD } from '~/server/utils/crawlerEventMatch'
import { suites } from './fixtures'

const apiKey = (process.env.OPENAI_API_KEY || '').trim()
const model = (process.env.OPENAI_MODEL_WEB || process.env.OPENAI_MODEL || 'gpt-4o').trim()
// Vitest hides passing-test console output, so the report is also written to a file.
const reportPath = process.env.EVAL_REPORT || resolve(process.cwd(), 'tests/eval/.last-run.txt')
const pad = (v: unknown, n: number) => String(v ?? '').padEnd(n).slice(0, n)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// The matcher uses maxRetries:0 (production latency). The eval fires many calls, so it
// retries on a transient API failure ('match_error') with backoff to ride out rate limits.
async function matchWithRetry(...args: Parameters<typeof matchCrawlerEvent>) {
  let res = await matchCrawlerEvent(...args)
  for (let attempt = 1; attempt <= 4 && res.reason === 'match_error'; attempt++) {
    await sleep(3000 * attempt)
    res = await matchCrawlerEvent(...args)
  }
  return res
}

// Calls the REAL OpenAI — skipped without a key. Run with: npm run eval:matcher
describe.skipIf(!apiKey)('crawler same-event matcher eval', () => {
  it('recognizes same-event variations and keeps distinct events apart', async () => {
    const out: string[] = []
    const misses: string[] = []
    let totalCorrect = 0
    let total = 0
    const matchedSims: number[] = [] // similarity on cases that SHOULD match
    const semNoMatchSims: number[] = [] // best similarity on SEMANTIC non-matches (excludes date-gated)

    for (const suite of suites) {
      out.push(`\n### suite: ${suite.name} (${suite.cases.length} cases) ###`)
      out.push(`${pad('EXPECTED', 16)} ${pad('GOT', 16)} ${pad('BEST', 16)} ${pad('SIM', 4)} OK  CASE`)
      let correct = 0
      for (const c of suite.cases) {
        await sleep(500) // pace calls to stay under the API rate limit
        const res = await matchWithRetry(c.formattedEvent as never, suite.candidatePool, c.messageText, {
          openaiApiKey: apiKey,
          openaiModel: model,
        })
        const ok = res.matchedId === c.expectedMatchId
        if (ok) { correct++; totalCorrect++ }
        total++
        out.push(`${pad(c.expectedMatchId ?? '∅', 16)} ${pad(res.matchedId ?? '∅', 16)} ${pad(res.bestCandidateId ?? '∅', 16)} ${pad(res.similarity, 4)} ${ok ? '✓' : '✗'}   ${c.name}`)
        if (!ok) misses.push(`[${suite.name}] ${c.name} → expected ${c.expectedMatchId ?? '∅'}, got ${res.matchedId ?? '∅'} (best ${res.bestCandidateId ?? '∅'}, sim ${res.similarity}) :: ${(res.reason || '').slice(0, 80)}`)

        // Classify for the SEMANTIC separation (a same-title/different-date reject is
        // handled by the deterministic date guard, not the similarity threshold).
        const caseDate = c.formattedEvent.occurrences[0]?.date || ''
        const bestCand = res.bestCandidateId ? suite.candidatePool.find((p) => p.id === res.bestCandidateId) : null
        const dateGated = !!caseDate && !!bestCand?.date && caseDate !== bestCand.date
        if (c.expectedMatchId !== null) matchedSims.push(res.similarity)
        else if (!dateGated) semNoMatchSims.push(res.similarity)
      }
      out.push(`suite accuracy: ${correct}/${suite.cases.length}`)
    }

    const accuracy = totalCorrect / total
    const minMatched = matchedSims.length ? Math.min(...matchedSims) : NaN
    const maxSemNoMatch = semNoMatchSims.length ? Math.max(...semNoMatchSims) : NaN

    out.push('')
    out.push('── overall ──────────────────────────────')
    out.push(`model: ${model}   threshold: ${MATCH_SIMILARITY_THRESHOLD}`)
    out.push(`accuracy: ${totalCorrect}/${total} = ${(accuracy * 100).toFixed(0)}%`)
    out.push(`semantic separation: min(should-match)=${minMatched}  vs  max(semantic should-NOT)=${maxSemNoMatch}  gap=${minMatched - maxSemNoMatch}`)
    out.push('(same-title / different-date rejects are handled by the date guard — excluded from the semantic gap above)')
    if (misses.length) { out.push('', `MISSES (${misses.length}):`, ...misses.map((m) => '  ' + m)) }

    const report = out.join('\n')
    console.log('\n' + report + '\n')
    try { writeFileSync(reportPath, report) } catch { /* report file is best-effort */ }

    // Push to high accuracy — tune the prompt/threshold until this passes with a clean gap.
    expect(accuracy).toBeGreaterThanOrEqual(0.9)
  })
})
