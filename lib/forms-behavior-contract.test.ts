import fs from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import baseline from './fixtures/forms-behavior-contract.json'

/** Freeze the non-rendering code and the interactive props, independently of layout. */
function contract(source: string) {
  const file = ts.createSourceFile('form.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const spans: Array<[number, number, string]> = []
  const props: string[] = []
  function isJsx(node: ts.Node) { return ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node) }
  function hasJsxParent(node: ts.Node) {
    let parent = node.parent
    while (parent) { if (isJsx(parent)) return true; parent = parent.parent }
    return false
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) spans.push([node.getStart(file), node.end, ''])
    if (isJsx(node) && !hasJsxParent(node)) spans.push([node.getStart(file), node.end, 'JSX'])
    if (ts.isJsxAttribute(node) && /^(on[A-Z]|ref$|initialFocusRef$|triggerRef$|triggerElement$|disabled$|readOnly$|inputMode$|min$|max$|maxLength$|type$|id$|aria-label$|aria-checked$|aria-pressed$)/.test(node.name.getText(file))) props.push(node.getText(file).replace(/\s+/g, ''))
    ts.forEachChild(node, visit)
  }
  visit(file)
  for (const [start, end, value] of spans.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + value + source.slice(end)
  return { logic: source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ''), props: props.sort() }
}

describe('forms redesign preserves behavior from b8e25fe', () => {
  for (const [path, original] of Object.entries(baseline)) {
    it(path, () => {
      // S5 adds exactly two pressed states to the approved contribution pills.
      const additions = path.endsWith('/GoalContributionSheet.tsx') ? [
        "aria-pressed={availabilityEffect==='none'}",
        "aria-pressed={availabilityEffect==='committed_only'}",
      ] : []
      expect(contract(fs.readFileSync(path, 'utf8'))).toEqual({ ...original, props: [...original.props, ...additions].sort() })
    })
  }
  it('leaves the expense list row untouched', () => {
    const source = fs.readFileSync('components/expenses/ExpenseItem.tsx', 'utf8')
    expect(source.slice(0, source.indexOf('<Modal'))).toMatchSnapshot()
  })
})
