import { HttpParams } from '@angular/common/http';
/** Omits only absent/empty fields. Zero and false are valid API values. */
export function queryParams(input: object) {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== null && value !== undefined && value !== '')
      params = params.set(key, String(value));
  }
  return params;
}
