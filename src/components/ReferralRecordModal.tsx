import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getReferralOrganisations, recordReferral, uploadReferralAttachment, type ReferralEntry } from '../api/referrals'
import { Input } from './Input'
import { Button } from './Button'
import { Modal } from './Modal'
import en from '../i18n/en'

export interface ReferralRecordModalProps {
  inquiryId: string
  open: boolean
  onClose: () => void
  onRecorded: (referral: ReferralEntry) => void
}

/** FR-REF-001 to 004. Records a referral against an inquiry, with an optional supporting attachment. */
export function ReferralRecordModal({ inquiryId, open, onClose, onRecorded }: ReferralRecordModalProps) {
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
    setFile(event.target.files?.[0] ?? null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={en.referrals.record.title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.referrals.record.organisationLabel}</span>
          <select
            required
            value={organisationId}
            onChange={(event) => setOrganisationId(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" disabled>
              {en.common.required}
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
          label={en.referrals.record.dateLabel}
          required
          value={referralDate}
          onChange={(event) => setReferralDate(event.target.value)}
        />

        <Input
          label={en.referrals.record.methodLabel}
          value={referralMethod}
          onChange={(event) => setReferralMethod(event.target.value)}
        />

        <Input
          label={en.referrals.record.contactLabel}
          value={contactPerson}
          onChange={(event) => setContactPerson(event.target.value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.referrals.record.remarksLabel}</span>
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={3}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{en.referrals.record.attachmentLabel}</span>
          <input type="file" onChange={handleFileChange} className="text-body-sm text-text-secondary" />
        </div>

        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{en.common.genericError}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {en.referrals.record.button}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {en.common.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
