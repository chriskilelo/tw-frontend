import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page-bg px-4 text-center">
      <h1 className="text-h1 text-primary">Page not found</h1>
      <Link to="/dashboard" className="text-body text-accent-text underline">
        Return to dashboard
      </Link>
    </div>
  )
}
