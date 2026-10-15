import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const up = readFileSync('docs/supabase-cards-due-day-nullable.sql', 'utf8')
const down = readFileSync('docs/supabase-cards-due-day-nullable-down.sql', 'utf8')
const upSql = up.split('-- DOWN')[0]

describe('due_day migration', () => {
  it('drops the default and the not-null without rewriting card rows', () => {
    expect(upSql).toMatch(/ALTER COLUMN due_day DROP NOT NULL/i)
    expect(upSql).toMatch(/ALTER COLUMN due_day DROP DEFAULT/i)
    expect(upSql).not.toMatch(/\bUPDATE\s+public\.cards\b/i)
    expect(upSql).not.toMatch(/\bUPDATE\s+cards\b/i)
    expect(upSql).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(upSql).not.toMatch(/due_day\s*=\s*10/)
  })

  it('is reversible and refuses to invent 10s in order to restore NOT NULL', () => {
    expect(down).toMatch(/DROP COLUMN IF EXISTS statement_answer/)
    expect(down).toMatch(/SET DEFAULT 10/)
    expect(down).toMatch(/refusing to restore NOT NULL/)
    expect(down).not.toMatch(/SET\s+due_day\s*=\s*10/i)
    expect(down).not.toMatch(/\bUPDATE\s+public\.cards\b/i)
  })
})
