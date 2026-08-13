import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { resetPassword } from '../../api/auth'
import type { ApiErrorEnvelope } from '../../api/client'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import AuthLayout from './AuthLayout'
import en from '../../i18n/en'

// FR-AUTH-008: minimum 8 characters, at least one uppercase, one lowercase, one number —
// mirrors tw-backend/app/Http/Requests/Api/Auth/ResetPasswordRequest.php exactly.
const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

// FR-AUTH-011. token/email arrive as query params on the emailed reset link.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: resetPassword,
    onError: (error) => {
      if (isAxiosError<ApiErrorEnvelope>(error)) {
        setServerError(error.response?.data?.errors?.[0] ?? en.common.genericError)
        return
      }
      setServerError(en.common.genericError)
    },
  })

  const complexityError =
    touched && !PASSWORD_COMPLEXITY.test(password) ? en.auth.resetPassword.passwordComplexity : undefined
  const matchError =
    touched && confirmPassword.length > 0 && password !== confirmPassword
      ? en.auth.resetPassword.passwordsDoNotMatch
      : undefined

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(true)
    setServerError(null)

    if (!PASSWORD_COMPLEXITY.test(password) || password !== confirmPassword) {
      return
    }

    mutation.mutate({ token, email, password, password_confirmation: confirmPassword })
  }

  if (mutation.isSuccess) {
    return (
      <AuthLayout>
        <h1 className="text-h2 text-primary">{en.auth.resetPassword.title}</h1>
        <p role="status" className="mt-4 text-body text-text-secondary">
          {en.auth.resetPassword.successMessage}
        </p>
        <Link to="/login" className="mt-6 inline-block text-body-sm text-primary underline">
          {en.auth.forgotPassword.backToLogin}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-h2 text-primary">{en.auth.resetPassword.title}</h1>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label={en.auth.resetPassword.newPasswordLabel}
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          error={complexityError}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <Input
          label={en.auth.resetPassword.confirmPasswordLabel}
          type="password"
          name="password_confirmation"
          autoComplete="new-password"
          required
          value={confirmPassword}
          error={matchError}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        {serverError && (
          <p role="alert" className="text-body-sm text-danger-soft-text">
            {serverError}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? en.common.loading : en.auth.resetPassword.submitButton}
        </Button>
      </form>
    </AuthLayout>
  )
}
