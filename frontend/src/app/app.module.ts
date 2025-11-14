import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { CalendarContainerComponent } from './components/calendar-cdk/calendar-container/calendar-container.component';
import { ApiService } from './services/api.service';

@NgModule({
  declarations: [
    AppComponent,
    CalendarComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    HttpClientModule,
    FormsModule,
    CalendarContainerComponent // Import standalone component
  ],
  providers: [ApiService],
  bootstrap: [AppComponent]
})
export class AppModule {
  // Espone Math per l'uso nei template
  Math = Math;
}
