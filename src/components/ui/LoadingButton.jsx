import { LoaderCircle } from 'lucide-react'

export default function LoadingButton({ loading = false, loadingText = 'Aguarde...', disabled = false, children, className = '', ...props }) {
  return (
    <button className={`${className} ${loading ? 'is-loading' : ''}`.trim()} disabled={disabled || loading} {...props}>
      {loading ? <><LoaderCircle className="button-spinner" size={17} /> {loadingText}</> : children}
    </button>
  )
}
