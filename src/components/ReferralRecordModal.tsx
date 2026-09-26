import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getReferralOrganisations, recordReferral, uploadReferralAttachment, type ReferralEntry } from '../api/referrals'
import { Input } from './Input'
import { Button } from './Button'
import { Modal } from './Modal'
import { useI18n } from '../i18n/context'

export interface ReferralRecordModalProps {
  inquiryId: string
  open: boolean
  onClose: () => void
  onRecorded: (referral: ReferralEntry) => void
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
// Must match StoreReferralAttachmentRequest's 'extensions' allowlist exactly (NFR-SEC-004,
// Session 38). This control previously had no accept attribute, no size/format hint, and
// no client-side validation at all (UI-007 gap, closed here) — a wrong file would only
// have been caught by the backend's 422 after the referral record itself was already
// created, matching the same class of gap AlertSubmitPage had.
const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'mp4', 'log']
const ACCEPTED_ATTACHMENT_TYPES = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

/** FR-REF-001 to 004. Records a referral against an inquiry, with an optional supporting attachment. */
export function ReferralRecordModal({ inquiryId, open, onClose, onRecorded }: ReferralRecordModalProps) {
  const { t } = useI18n()
  const organisationsQuery = useQuery({
    queryKey: ['referral-organisations'],
    queryFn: getReferralOrganisations,
    enabled: open,
  })

  const [organisationId, setOrganisationId] = useState('')
  const [referralDate, setReferralDate] = useState('')
  const [referralMethod, setReferralMethod] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [remarks, setRemarks] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const referral = await recordReferral(inquiryId, {
        referral_organisation_id: organisationId,
        referral_date: referralDate,
        referral_method: referralMethod || undefined,
        contact_person: contactPerson || undefined,
        remarks: remarks || undefined,
      })
      if (file) {
        await uploadReferralAttachment(referral.id, file)
      }
      return referral
    },
    onSuccess: (referral) => {
      setOrganisationId('')
      setReferralDate('')
      setReferralMethod('')
      setContactPerson('')
      setRemarks('')
      setFile(null)
      onRecorded(referral)
    },
  })

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null

    if (!selected) {
      setFile(null)
      setFileError(null)
      return
    }

    if (selected.size > MAX_ATTACHMENT_BYTES) {
      setFileError(t.referrals.record.attachmentSizeError)
      return
    }

    const extension = selected.name.split('.').pop()?.toLowerCase()
    if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
      setFileError(t.referrals.record.attachmentTypeError)
      return
    }

    setFileError(null)
    setFile(selected)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={t.referrals.record.title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.referrals.record.organisationLabel}</span>
          <select
            required
            value={organisationId}
            onChange={(event) => setOrganisationId(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" disabled>
              {t.common.required}
            </option>
            {(organisationsQuery.data ?? []).map((organisation) => (
              <option key={organisation.id} value={organisation.id}>
                {organisation.name}
              </option>
            ))}
          </select>
        </label>

        <Input
          type="date"
          label={t.referrals.record.dateLabel}
          required
          value={referralDate}
          onChange={(event) => setReferralDate(event.target.value)}
        />

        <Input
          label={t.referrals.record.methodLabel}
          value={referralMethod}
          onChange={(event) => setReferralMethod(event.target.value)}
        />

        <Input
          label={t.referrals.record.contactLabel}
          value={contactPerson}
          onChange={(event) => setContactPerson(event.target.value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.referrals.record.remarksLabel}</span>
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={3}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <div className="flex flex-col gap-1">
          {/* Previously a <div>/<span> pair with no real label association (an
              accessibility gap distinct from the UI-007 hint text this session added) —
              every other field in this form already uses <label>; this one now matches. */}
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-text-secondary">{t.referrals.record.attachmentLabel}</span>
            <input
              type="file"
              accept={ACCEPTED_ATTACHMENT_TYPES}
              onChange={handleFileChange}
              className="text-body-sm text-text-secondary"
            />
          </label>
          <p className="text-caption text-text-muted">{t.referrals.record.attachmentHint}</p>
          {fileError && <p className="text-caption text-danger-soft-text">{fileError}</p>}
        </div>

        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {t.referrals.record.button}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
