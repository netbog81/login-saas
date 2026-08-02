import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TrattamentiContainer } from './trattamenti.container';

/**
 * Wrapper route-level attorno a TrattamentiContainer.
 * Serve solo a fornire il layout full-page; tutta la logica sta nel container.
 */
@Component({
  selector: 'app-trattamenti-page-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TrattamentiContainer],
  template: `
    <div class="page">
      <app-trattamenti-container [openTreatmentId]="openTreatmentId"></app-trattamenti-container>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .page {
      padding: 16px 24px;
      height: 100%;
      box-sizing: border-box;
      overflow: auto;
    }
  `],
})
export class TrattamentiPageContainer {
  /** Deep-link /trattamenti/:treatmentId (es. "apri nel clinico" da accounting). */
  readonly openTreatmentId = inject(ActivatedRoute).snapshot.paramMap.get('treatmentId');
}
