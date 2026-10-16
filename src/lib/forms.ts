/**
 * Shared form validation used on the client (for instant feedback) and on the
 * server route (/api/enquiry) so that the rules can't be bypassed.
 */

export type FormType = "investor" | "farmer" | "contact";
export type FormValues = Record<string, string | string[]>;
export type FormErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Accepts Pakistani and international formats: +92 300 1234567, 0300-1234567, +44 7700 900123
const PHONE = /^\+?[0-9][0-9\s\-()]{6,18}[0-9]$/;

const str = (v: FormValues[string] | undefined) => (Array.isArray(v) ? v.join(", ") : (v ?? "")).trim();

function requireText(values: FormValues, errors: FormErrors, field: string, message: string, max = 200) {
  const v = str(values[field]);
  if (!v) errors[field] = message;
  else if (v.length > max) errors[field] = `Please keep this under ${max} characters.`;
}

export function validate(type: FormType, values: FormValues): FormErrors {
  const errors: FormErrors = {};

  requireText(values, errors, "name", "Please enter your full name.", 120);

  const phone = str(values.phone);
  if (type !== "contact" || phone) {
    if (!phone) errors.phone = "Please enter a phone number we can reach you on.";
    else if (!PHONE.test(phone)) errors.phone = "Please enter a valid phone number, e.g. +92 300 1234567.";
  }

  if (type === "investor" || type === "contact") {
    const email = str(values.email);
    if (!email) errors.email = "Please enter your email address.";
    else if (!EMAIL.test(email)) errors.email = "Please enter a valid email address.";
  }

  if (type === "investor") {
    requireText(values, errors, "location", "Please tell us your city or country of residence.", 120);
    if (!str(values.budget)) errors.budget = "Please choose an indicative budget (or “Other”).";
    if (!str(values.horizon)) errors.horizon = "Please choose a preferred horizon.";
    if (str(values.message).length > 2000) errors.message = "Please keep your message under 2,000 characters.";
  }

  if (type === "farmer") {
    requireText(values, errors, "cityDistrict", "Please enter your city and district.", 120);
    requireText(values, errors, "farmLocation", "Please describe where your farm is located.", 200);
    if (!str(values.experience)) errors.experience = "Please select your livestock experience.";
    requireText(values, errors, "capacity", "Please tell us how many animals you can care for.", 60);
    if (!str(values.livestockTypes)) errors.livestockTypes = "Please select at least one type of livestock.";
    requireText(values, errors, "farmDescription", "Please briefly describe your farm.", 2000);
  }

  if (type === "contact") {
    requireText(values, errors, "subject", "Please choose a topic.", 80);
    requireText(values, errors, "message", "Please enter your message.", 2000);
  }

  if (str(values.consent) !== "yes") {
    errors.consent =
      type === "farmer"
        ? "Please confirm you consent to verification and to being contacted."
        : "Please confirm you consent to being contacted.";
  }

  return errors;
}

export function formDataToValues(fd: FormData): FormValues {
  const values: FormValues = {};
  for (const key of new Set(fd.keys())) {
    const all = fd.getAll(key).map(String);
    values[key] = all.length > 1 || key === "livestockTypes" ? all : all[0];
  }
  return values;
}
