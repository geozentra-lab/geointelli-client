import { Component, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
export interface Confirmation {
  title: string;
  message: string;
  confirmLabel?: string;
}
@Component({
  imports: [MatDialogModule],
  template: `<h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content
      ><p>{{ data.message }}</p></mat-dialog-content
    ><mat-dialog-actions align="end"
      ><button type="button" class="btn" [mat-dialog-close]="false" cdkFocusInitial>Cancel</button
      ><button type="button" class="btn danger" [mat-dialog-close]="true">
        {{ data.confirmLabel || 'Delete' }}
      </button></mat-dialog-actions
    >`,
  styles: `
    p {
      line-height: 1.7;
      color: var(--ink-2);
      margin: 0;
    }
    mat-dialog-actions {
      padding: 16px 24px 24px;
      gap: 8px;
    }
  `,
})
export class ConfirmDialog {
  data = inject<Confirmation>(MAT_DIALOG_DATA);
}
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private dialog = inject(MatDialog);
  async confirm(data: Confirmation): Promise<boolean> {
    return (
      (await firstValueFrom(
        this.dialog
          .open(ConfirmDialog, {
            data,
            width: '440px',
            maxWidth: 'calc(100vw - 32px)',
            restoreFocus: true,
            autoFocus: 'first-tabbable',
          })
          .afterClosed(),
      )) === true
    );
  }
}
