import { HttpErrorResponse } from '@angular/common/http';
export function apiError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'The service could not be reached. Please retry.';
    if (error.status === 401) return 'Sign in to access your account data.';
    if (error.status === 403) return 'Your account cannot access this resource.';
    if (error.status === 404) return 'This record could not be found.';
    if (error.status === 409) {
      // Conflicts explain the business rule that blocked the change (e.g. an invalid transition).
      const message = error.error?.message;
      return typeof message === 'string' && message.trim()
        ? message
        : 'This change conflicts with existing data. Refresh and try again.';
    }
    if (error.status === 400) {
      const message = error.error?.message;
      return typeof message === 'string' && message.trim()
        ? plainValidation(message)
        : 'Please check the supplied fields.';
    }
  }
  return 'The request could not be completed. Please retry.';
}

/** Bean Validation's default messages, as they read after a field's name. */
const RULES: [RegExp, string][] = [
  [/^must be a date in the past or in the present$/, "can't be in the future"],
  [/^must be a date in the present or in the future$/, "can't be in the past"],
  [/^must be a past date$/, 'must be before today'],
  [/^must be a future date$/, 'must be after today'],
  [/^must not be (null|blank|empty)$/, 'is required'],
  [/^size must be between (\d+) and (\d+)$/, 'must be $1 to $2 characters'],
  [/^must be a well-formed email address$/, 'must be an email address'],
  [/^numeric value out of bounds.*$/, 'has too many digits'],
  [/^invalid value$/, 'has an invalid value'],
];

/** `transactionDate` → `transaction date`: a field name as words. */
const words = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

/**
 * The backend's 400 text in words. It sends one `field: message` per broken rule, joined by `; `
 * (`transactionDate: must be a date in the past or in the present`), or a sentence that names
 * fields in code (`periodStart and periodEnd must be supplied or cleared together`). Each becomes a
 * sentence: "Transaction date can't be in the future."
 */
export function plainValidation(message: string): string {
  return message
    .split(/;\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const rule = /^([\w.[\]]+):\s*(.+)$/.exec(part);
      let sentence = part;
      if (rule) {
        const field = words(rule[1].split('.').pop()!.replace(/\[\d+\]/g, ''));
        const said = RULES.reduce((text, [pattern, plain]) => text.replace(pattern, plain), rule[2]);
        sentence = field + ' ' + said;
      }
      sentence = sentence.replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g, words);
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      return /[.!?]$/.test(sentence) ? sentence : sentence + '.';
    })
    .join(' ');
}
