import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const [baselinePath, headPath] = process.argv.slice(2)
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const head = JSON.parse(readFileSync(headPath, 'utf8'))
assert.deepEqual(head.payloads, baseline.payloads, 'Income/transfer save payloads must remain identical')
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
for (const width of [390, 1440]) {
  const before = baseline.reports.filter(row => row.width === width)
  const after = head.reports.filter(row => row.width === width)
  const beforeBytes = median(before.map(row => row.initial.gzip))
  const afterBytes = median(after.map(row => row.initial.gzip))
  assert.equal(before.length, 3)
  assert.equal(after.length, 3)
  assert(afterBytes < beforeBytes, `${width}: initial JS must actually decrease`)
  console.log(JSON.stringify({ width, beforeGzipBytes: beforeBytes, afterGzipBytes: afterBytes, reductionPct: Number((100 * (beforeBytes - afterBytes) / beforeBytes).toFixed(2)), beforeIncomeMs: median(before.map(row => row.incomeOpenMs)), afterIncomeMs: median(after.map(row => row.incomeOpenMs)), scope: head.scope }))
}
