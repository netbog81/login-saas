import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<app-calendar></app-calendar>',
  styles: []
})
export class AppComponent {
  title = 'Calendario Poliambulatorio';

  // Espone Math al template
  Math = Math;
}
