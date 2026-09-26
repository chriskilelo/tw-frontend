import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getInquiryCategories, logInquiry, type InquiryCreateRequest, type InquirySubType } from '../../api/inquiries'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/context'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** FR-INQ-002, FR-INQ-003, FR-INQ-022. country, mission, and logged_by are system-derived (BR-014), not collected here. */
export default function LogInquiryPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const categoriesQuery = useQuery({
    queryKey: ['inquiry-categories'],
    queryFn: getInquiryCategories,
  })

  const [inquirerName, setInquirerName] = useState('')
  const [inquirerOrganisation, setInquirerOrganisation] = useState('')
  const [inquirerEmail, setInquirerEmail] = useState('')
  const [inquirerPhone, setInquirerPhone] = useState('')
  const [category, setCategory] = useState('')
  const [subType, setSubType] = useState<InquirySubType>('standard')
  const [description, setDescription] = useState('')
  const [productOrSector, setProductOrSector] = useState('')
  const [dateReceived, setDateReceived] = useState(today())

  const mutation = useMutation({
    mutationFn: (payload: InquiryCreateRequest) => logInquiry(payload),
    onSuccess: (inquiry) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      navigate(`/inquiries/${inquiry.id}`)
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      category,
      sub_type: subType,
      inquirer_name: inquirerName,
      inquirer_organisation: inquirerOrganisation || undefined,
      inquirer_email: inquirerEmail || undefined,
      inquirer_phone: inquirerPhone || undefined,
      product_or_sector: productOrSector || undefined,
      description: description || undefined,
      date_received: dateReceived,
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.inquiries.log.title}</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-2xl flex-col gap-4">
        <Input
          label={t.inquiries.log.inquirerNameLabel}
          required
          value={inquirerName}
          onChange={(event) => setInquirerName(event.target.value)}
        />

        <Input
          label={t.inquiries.log.inquirerOrganisationLabel}
          value={inquirerOrganisation}
          onChange={(event) => setInquirerOrganisation(event.target.value)}
        />

        <Input
          type="email"
          label={t.inquiries.log.inquirerEmailLabel}
          value={inquirerEmail}
          onChange={(event) => setInquirerEmail(event.target.value)}
        />

        <Input
          label={t.inquiries.log.inquirerPhoneLabel}
          value={inquirerPhone}
          onChange={(event) => setInquirerPhone(event.target.value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.inquiries.log.categoryLabel}</span>
          <select
            required
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" disabled>
              {t.common.required}
            </option>
            {(categoriesQuery.data ?? []).map((option) => (
              <option key={option.id} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm font-semibold text-text-secondary">{t.inquiries.log.subTypeLabel}</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="sub_type"
                value="standard"
                checked={subType === 'standard'}
                onChange={() => setSubType('standard')}
                className="h-4 w-4 border-border text-accent focus:ring-accent"
              />
              <span className="text-body text-text-primary">{t.inquiries.subType.standard}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="sub_type"
                value="dispute_or_complaint"
                checked={subType === 'dispute_or_complaint'}
                onChange={() => setSubType('dispute_or_complaint')}
                className="h-4 w-4 border-border text-accent focus:ring-accent"
              />
              <span className="text-body text-text-primary">{t.inquiries.subType.dispute_or_complaint}</span>
            </label>
          </div>
        </fieldset>

        <Input
          label={t.inquiries.log.productOrSectorLabel}
          value={productOrSector}
          onChange={(event) => setProductOrSector(event.target.value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-body-sm font-semibold text-text-secondary">{t.inquiries.log.descriptionLabel}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="rounded border border-border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <Input
          type="date"
          label={t.inquiries.log.dateReceivedLabel}
          required
          value={dateReceived}
          onChange={(event) => setDateReceived(event.target.value)}
        />

        {mutation.isError && <p className="text-body-sm text-danger-soft-text">{t.common.genericError}</p>}

        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t.inquiries.log.button}
        </Button>
      </form>
    </div>
  )
}
