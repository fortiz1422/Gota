export async function rememberCounterpartyAfterConfirmation<T>(input: {
  confirmExpense: () => Promise<T>
  saveAlias: () => Promise<unknown>
  remember: boolean
}): Promise<{ expense: T; aliasSaved: boolean | null }> {
  const expense = await input.confirmExpense()
  if (!input.remember) return { expense, aliasSaved: null }
  try {
    await input.saveAlias()
    return { expense, aliasSaved: true }
  } catch {
    return { expense, aliasSaved: false }
  }
}
