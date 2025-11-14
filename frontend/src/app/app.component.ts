import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<app-calendar-container></app-calendar-container>',
  styles: []
})
export class AppComponent {
  title = 'Calendario Poliambulatorio CDK';

  // Espone Math al template
  Math = Math;
}
