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

export type ResetPasswordMode = 'reset' | 'activate'

interface ResetPasswordPageProps {
  /**
   * 'reset' serves /reset-password (FR-AUTH-011); 'activate' serves /activate
   * (FR-AUTH-002). Both complete POST /password/reset with the emailed token,
   * because activation reuses the password-reset broker (AccountActivationMail).
   */
  mode?: ResetPasswordMode
}

// token/email arrive as query params on the emailed link.
export default function ResetPasswordPage({ mode = 'reset' }: ResetPasswordPageProps) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const isActivation = mode === 'activate'
  const copy = isActivation ? en.auth.activateAccount : en.auth.resetPassword

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: resetPassword,
    onError: (error) => {
      if (isAxiosError<ApiErrorEnvelope>(error)) {
        // The client checks mirror the server's password rules, so a 422 here means the
        // token, email or link was refused. The broker's wording ("password reset token")
        // would confuse someone activating a new account.
        if (isActivation && error.response?.status === 422) {
          setServerError(en.auth.activateAccount.linkInvalid)
          return
        }
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
        <h1 className="text-h2 text-primary">{copy.title}</h1>
        <p role="status" className="mt-4 text-body text-text-secondary">
          {copy.successMessage}
        </p>
        <Link to="/login" className="mt-6 inline-block text-body-sm text-primary underline">
          {en.auth.forgotPassword.backToLogin}
        </Link>
      </AuthLayout>
    )
  }

  // A link cut short by an email client can't succeed, so say so up front rather than
  // letting the user choose a password only to have it refused.
  if (token === '' || email === '') {
    return (
      <AuthLayout>
        <h1 className="text-h2 text-primary">{copy.title}</h1>
        <p role="alert" className="mt-4 text-body text-text-secondary">
          {copy.linkIncomplete}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {!isActivation && (
            <Link to="/forgot-password" className="text-body-sm text-primary underline">
              {en.auth.resetPassword.requestNewLink}
            </Link>
          )}
          <Link to="/login" className="text-body-sm text-primary underline">
            {en.auth.forgotPassword.backToLogin}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-h2 text-primary">{copy.title}</h1>
      {isActivation && <p className="mt-2 text-body text-text-secondary">{en.auth.activateAccount.intro}</p>}
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label={copy.newPasswordLabel}
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
          label={copy.confirmPasswordLabel}
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
          <div role="alert" className="text-body-sm text-danger-soft-text">
            <p>{serverError}</p>
            {!isActivation && (
              <Link to="/forgot-password" className="mt-1 inline-block text-primary underline">
                {en.auth.resetPassword.requestNewLink}
              </Link>
            )}
          </div>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? en.common.loading : copy.submitButton}
        </Button>
      </form>
    </AuthLayout>
  )
}
