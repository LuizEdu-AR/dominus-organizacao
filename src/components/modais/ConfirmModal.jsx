export default function ConfirmModal({ open, title, description, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{title}</h3>
        <p className="muted">{description}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
