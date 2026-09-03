export const money = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

export const dateTime = (value) => {
  if (!value) return '-'
  const date = value?.toDate ? value.toDate() : new Date(value)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
