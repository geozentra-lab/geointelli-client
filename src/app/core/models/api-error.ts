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
      return typeof message === 'string' ? message : 'Please check the supplied fields.';
    }
  }
  return 'The request could not be completed. Please retry.';
}
