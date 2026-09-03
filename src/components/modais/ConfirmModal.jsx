import LoadingButton from '../ui/LoadingButton'

export default function ConfirmModal({ open, title, description, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel, loading = false }) {
  if (!open) return null
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{title}</h3>
        <p className="muted">{description}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} disabled={loading}>Cancelar</button>
          <LoadingButton className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} loading={loading} loadingText="Aguarde...">{confirmLabel}</LoadingButton>
        </div>
      </div>
    </div>
  )
}
