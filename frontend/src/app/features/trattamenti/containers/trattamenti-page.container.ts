import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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
      <app-trattamenti-container></app-trattamenti-container>
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
export class TrattamentiPageContainer {}
