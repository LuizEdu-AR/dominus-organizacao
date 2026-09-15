import { useEffect, useMemo, useState } from 'react'

function getVisiblePages(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const pages = new Set([1, totalPages])
  for (let current = page - 2; current <= page + 2; current += 1) {
    if (current > 1 && current < totalPages) pages.add(current)
  }

  const ordered = [...pages].sort((a, b) => a - b)
  const result = []
  ordered.forEach((value, index) => {
    if (index > 0 && value - ordered[index - 1] > 1) result.push(`ellipsis-${value}`)
    result.push(value)
  })
  return result
}

export default function Pagination({ page, totalPages, onChange, compact = false, showPageInput = false }) {
  const [pageInput, setPageInput] = useState(String(page))
  useEffect(() => { setPageInput(String(page)) }, [page])

  const pages = useMemo(
    () => compact ? getVisiblePages(page, totalPages) : Array.from({ length: totalPages }, (_, i) => i + 1),
    [compact, page, totalPages],
  )

  if (totalPages <= 1 && !showPageInput) return null

  function goToTypedPage() {
    const requested = Number.parseInt(pageInput, 10)
    if (!Number.isFinite(requested)) {
      setPageInput(String(page))
      return
    }
    const nextPage = Math.min(totalPages, Math.max(1, requested))
    setPageInput(String(nextPage))
    onChange(nextPage)
  }

  return (
    <div className={`pagination${compact ? ' compact' : ''}`}>
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</button>
      {pages.map(item => typeof item === 'string'
        ? <span className="pagination-ellipsis" key={item}>...</span>
        : <button key={item} className={item === page ? 'active' : ''} onClick={() => onChange(item)}>{item}</button>
      )}
      {showPageInput && (
        <label className="pagination-jump">
          <span>Página</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={pageInput}
            onChange={event => setPageInput(event.target.value)}
            onBlur={goToTypedPage}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                goToTypedPage()
                event.currentTarget.blur()
              }
            }}
            aria-label="Ir para página"
          />
        </label>
      )}
      <button disabled={page === totalPages} onClick={() => onChange(page + 1)}>Próximo</button>
    </div>
  )
}
