import { HttpErrorResponse } from '@angular/common/http';
import { apiError, plainValidation } from './api-error';

const bad = (message: unknown) =>
  apiError(new HttpErrorResponse({ status: 400, error: { status: 400, message } }));

describe('API errors in words', () => {
  it('says a refused future date by its field (POST financial-records, Nov 26, 2026)', () => {
    expect(bad('transactionDate: must be a date in the past or in the present')).toBe(
      "Transaction date can't be in the future.",
    );
  });

  it('says each broken rule as its own sentence, by the last part of its field', () => {
    expect(
      plainValidation(
        'amount: must be greater than 0; financing.balanceAsOfDate: must be a date in the past or in the present',
      ),
    ).toBe("Amount must be greater than 0. Balance as of date can't be in the future.");
    expect(plainValidation('reason: size must be between 1 and 500')).toBe(
      'Reason must be 1 to 500 characters.',
    );
    expect(plainValidation('category: must not be null')).toBe('Category is required.');
    expect(plainValidation('page: invalid value')).toBe('Page has an invalid value.');
    expect(plainValidation('items[2].amount: numeric value out of bounds (<12 digits>.<2 digits> expected)')).toBe(
      'Amount has too many digits.',
    );
  });

  it('puts field names in a sentence into words, and leaves the rest as sent', () => {
    expect(plainValidation('periodStart and periodEnd must be supplied or cleared together')).toBe(
      'Period start and period end must be supplied or cleared together.',
    );
    expect(plainValidation('email must be an email address')).toBe('Email must be an email address.');
    expect(plainValidation('Invalid JSON body or unsupported field value')).toBe(
      'Invalid JSON body or unsupported field value.',
    );
    expect(plainValidation('currency: must be USD')).toBe('Currency must be USD.');
  });

  it('keeps the general wording when a 400 has no message', () => {
    expect(bad(undefined)).toBe('Please check the supplied fields.');
    expect(bad('  ')).toBe('Please check the supplied fields.');
  });
});
