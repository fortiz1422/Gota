import { CATEGORIES } from '@/lib/validation/schemas'

export function createExpenseCategoryGuidance({ allowNull }: { allowNull: boolean }): string {
  return `CATEGORIA:
- Categorias canonicas (responde exclusivamente con una de estas):
${CATEGORIES.join(', ')}
- Inferi la categoria por el significado y el contexto del gasto; no exijas que el texto repita literalmente el nombre de la categoria.
- Ejemplos: medicamentos o una compra en farmacia => Farmacia; consulta medica, estudio o tratamiento => Salud; combustible o estacion de servicio => Auto/Combustible.
- ${allowNull
    ? 'Para una compra, propone la categoria mas apropiada cuando la evidencia sea razonablemente clara; usa null solo si no alcanza.'
    : 'Para un gasto valido, elegi la categoria mas apropiada; usa Otros solo cuando el significado realmente no permita una categoria mas especifica.'}`
}