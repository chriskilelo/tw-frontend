import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { forgotPassword } from '../../api/auth'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import AuthLayout from './AuthLayout'
import en from '../../i18n/en'

// FR-AUTH-011. The backend always returns a generic 200 regardless of whether the
// email is registered (account-enumeration prevention), so the success state below
// is the only response path this page needs to render.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')

  const mutation = useMutation({ mutationFn: forgotPassword })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({ email })
  }

  if (mutation.isSuccess) {
    return (
      <AuthLayout>
        <h1 className="text-h2 text-primary">{en.auth.forgotPassword.title}</h1>
        <p role="status" className="mt-4 text-body text-text-secondary">
          {en.auth.forgotPassword.successMessage}
        </p>
        <Link to="/login" className="mt-6 inline-block text-body-sm text-primary underline">
          {en.auth.forgotPassword.backToLogin}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-h2 text-primary">{en.auth.forgotPassword.title}</h1>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label={en.auth.forgotPassword.emailLabel}
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {mutation.isError && (
          <p role="alert" className="text-body-sm text-danger-soft-text">
            {en.common.genericError}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? en.common.loading : en.auth.forgotPassword.submitButton}
        </Button>
        <Link to="/login" className="text-center text-body-sm text-primary underline">
          {en.auth.forgotPassword.backToLogin}
        </Link>
      </form>
    </AuthLayout>
  )
}
