import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { login } from '../../api/auth'
import type { ApiErrorEnvelope } from '../../api/client'
import { AUTH_QUERY_KEY } from '../../hooks/useAuth'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import AuthLayout from './AuthLayout'
import en from '../../i18n/en'

// FR-AUTH-007, FR-AUTH-009.
export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      setErrorMessage(null)
      // Repopulate the 'me' query so ProtectedRoute (router.tsx) sees the new session immediately.
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
      navigate('/dashboard', { replace: true })
    },
    onError: (error) => {
      if (isAxiosError<ApiErrorEnvelope>(error)) {
        if (error.response?.status === 423) {
          setErrorMessage(en.auth.login.accountLocked)
          return
        }
        if (error.response?.status === 401) {
          setErrorMessage(en.auth.login.invalidCredentials)
          return
        }
      }
      setErrorMessage(en.common.genericError)
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    mutation.mutate({ email, password })
  }

  return (
    <AuthLayout>
      <h1 className="text-h2 text-primary">{en.auth.login.title}</h1>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label={en.auth.login.emailLabel}
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label={en.auth.login.passwordLabel}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {errorMessage && (
          <p role="alert" className="text-body-sm text-danger-soft-text">
            {errorMessage}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? en.common.loading : en.auth.login.submitButton}
        </Button>
        <Link to="/forgot-password" className="text-center text-body-sm text-primary underline">
          {en.auth.login.forgotPasswordLink}
        </Link>
      </form>
    </AuthLayout>
  )
}
