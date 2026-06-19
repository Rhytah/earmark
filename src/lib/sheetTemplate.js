import { getCurrentMonth } from './constants'

/**
 * CSV template for Google Sheets sync — one flat table, no side panels.
 * Category names should match Settings → Budget.
 */
export function buildExpenseSheetTemplateCsv({ categories = [], paymentMethods = [] }) {
  const cats =
    categories.length > 0
      ? categories
      : ['Groceries', 'Transport', 'Subscriptions', 'Dining & misc', 'Gym']
  const pay = paymentMethods[0] || 'Card'
  const month = getCurrentMonth()

  const header = 'date,category,description,amount,payment_method'
  const rows = [
    [`${month}-01`, cats[0], 'Coffee', '12000', pay],
    [`${month}-02`, cats[1] || cats[0], 'Fuel', '85000', pay],
    [`${month}-03`, cats[2] || cats[0], 'Netflix', '45000', pay],
  ]

  return [header, ...rows.map((r) => r.join(','))].join('\n')
}

export function downloadExpenseSheetTemplate(settings) {
  const csv = buildExpenseSheetTemplateCsv({
    categories: (settings?.budget || []).map((b) => b.category),
    paymentMethods: settings?.payment_methods || [],
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'earmark-expenses-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
