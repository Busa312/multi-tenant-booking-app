import { useI18n } from "../i18n/I18nContext.js";
import { Field, TextInput, Textarea } from "./ui/index.js";

export interface HomeAddress {
  address: string;
  details: string;
  note: string;
}

interface HomeAddressFieldsProps {
  value: HomeAddress;
  onChange: (next: HomeAddress) => void;
  /** Keeps ids unique when two forms could share a page. */
  idPrefix: string;
}

// R630: where the professional goes for a visit at the customer's address.
// Free text, as on the booking site — no map, no lookup.
export function HomeAddressFields({ value, onChange, idPrefix }: HomeAddressFieldsProps) {
  const { t } = useI18n();
  const set = (field: keyof HomeAddress) => (next: string) => onChange({ ...value, [field]: next });
  return (
    <>
      <Field label={t("bookings.addressLabel")} htmlFor={`${idPrefix}-address`}>
        <TextInput
          id={`${idPrefix}-address`}
          value={value.address}
          maxLength={200}
          autoComplete="street-address"
          onChange={(e) => set("address")(e.target.value)}
          placeholder={t("bookings.addressPlaceholder")}
          required
        />
      </Field>
      <Field label={t("bookings.addressDetailsLabel")} htmlFor={`${idPrefix}-address-details`}>
        <TextInput
          id={`${idPrefix}-address-details`}
          value={value.details}
          maxLength={100}
          onChange={(e) => set("details")(e.target.value)}
        />
      </Field>
      <Field label={t("bookings.addressNoteLabel")} htmlFor={`${idPrefix}-address-note`}>
        <Textarea
          id={`${idPrefix}-address-note`}
          rows={2}
          value={value.note}
          maxLength={300}
          onChange={(e) => set("note")(e.target.value)}
          placeholder={t("bookings.addressNotePlaceholder")}
        />
      </Field>
    </>
  );
}
