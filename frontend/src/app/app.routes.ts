import { Routes } from '@angular/router';
import { authGuard, linkedGuard } from './core/auth/auth.guard';
import { schemaGuard } from './core/auth/schema.guard';
import { CalendarContainerComponent } from './components/calendar-cdk/calendar-container/calendar-container.component';
import { AvailabilityDashboardComponent } from './components/availability/availability-dashboard/availability-dashboard.component';
import { ConflictDashboardComponent } from './components/conflict-dashboard/conflict-dashboard.component';
import { SettingsComponent } from './components/settings/settings.component';
import { PatientManagementComponent } from './components/patients/patient-management/patient-management.component';
import { OperatorWorkspaceContainer } from './features/operators-new/containers/operator-workspace.container';
import { OperatorsNewLayoutComponent } from './features/operators-new/layout/operators-new-layout.component';
import { OperatorsDashboardContainer } from './features/operators-new/containers/operators-dashboard.container';
import { OperatorsPatientsContainer } from './features/operators-new/containers/operators-patients.container';
import { CallbackComponent } from './features/auth/components/callback/callback.component';
import { PendingActivationComponent } from './features/auth/components/pending-activation/pending-activation.component';
import { PendingSchemaComponent } from './features/auth/components/pending-schema/pending-schema.component';
import { UnauthorizedComponent } from './features/auth/components/unauthorized/unauthorized.component';
import { AdminComponent } from './features/admin/admin.component';
import { WhatsappLayoutComponent } from './features/whatsapp/whatsapp-layout.component';
import { WhatsappMonitorContainer } from './features/whatsapp/containers/whatsapp-monitor.container';
import { WhatsappSettingsContainer } from './features/whatsapp/containers/whatsapp-settings.container';
import { WhatsappLogManagementContainer } from './features/whatsapp/containers/whatsapp-log-management.container';
import { InstructorsLayoutComponent } from './features/instructors/layout/instructors-layout.component';
import { InstructorAppointmentsContainer } from './features/instructors/containers/instructor-appointments.container';
import { InstructorInProgressContainer } from './features/instructors/containers/instructor-in-progress.container';

export const routes: Routes = [
  // --- Callback OIDC Keycloak (nessun guard: la libreria processa il code qui) ---
  {
    path: 'callback',
    component: CallbackComponent,
    title: 'Accesso in corso...',
  },
  {
    path: 'unauthorized',
    component: UnauthorizedComponent,
    title: 'Accesso Negato',
  },

  // --- Rotte protette (solo auth, mapping non richiesto) ---
  {
    path: 'pending-activation',
    component: PendingActivationComponent,
    canActivate: [authGuard],
    title: 'Attivazione in corso',
  },
  {
    path: 'pending-schema',
    component: PendingSchemaComponent,
    canActivate: [authGuard],
    title: 'Database in configurazione',
  },

  // --- Admin Dashboard (auth + linked, nessun schemaGuard: l'admin gestisce lo schema qui) ---
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authGuard, linkedGuard],
    data: { roles: ['admin', 'amministratore', 'superadmin', 'it_manager'] },
    title: 'Amministrazione',
  },

  // --- Rotte protette (auth + mapping attivo + schema pronto) ---
  {
    path: 'calendar',
    component: CalendarContainerComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    title: 'Calendario',
  },
  {
    path: 'patients',
    component: PatientManagementComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    title: 'Gestione Pazienti',
  },
  {
    path: 'operatori-new',
    component: OperatorsNewLayoutComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    data: { roles: ['operatore', 'medico', 'admin', 'amministratore', 'superadmin', 'it_manager'] },
    title: 'Workspace Operatore',
    children: [
      {
        path: '',
        redirectTo: 'appuntamenti',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: OperatorsDashboardContainer,
        title: 'Dashboard Operatori',
      },
      {
        path: 'pazienti',
        component: OperatorsPatientsContainer,
        title: 'Pazienti',
      },
      {
        path: 'appuntamenti',
        component: OperatorWorkspaceContainer,
        title: 'Appuntamenti',
      },
    ],
  },
  {
    path: 'istruttori',
    component: InstructorsLayoutComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    data: { roles: ['operatore', 'admin', 'amministratore', 'superadmin', 'it_manager'] },
    title: 'Workspace Istruttore',
    children: [
      {
        path: '',
        redirectTo: 'appuntamenti',
        pathMatch: 'full',
      },
      {
        path: 'appuntamenti',
        component: InstructorAppointmentsContainer,
        title: 'Appuntamenti Istruttore',
      },
      {
        path: 'in-corso',
        component: InstructorInProgressContainer,
        title: 'In Corso',
      },
    ],
  },
  {
    path: 'availability',
    component: AvailabilityDashboardComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    title: 'Gestione Disponibilita',
  },
  {
    path: 'conflicts',
    component: ConflictDashboardComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    title: 'Dashboard Conflitti',
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    data: { roles: ['admin', 'amministratore', 'superadmin'] },
    title: 'Impostazioni Generali',
  },
  {
    path: 'whatsapp',
    component: WhatsappLayoutComponent,
    canActivate: [authGuard, linkedGuard, schemaGuard],
    data: { roles: ['admin', 'amministratore', 'superadmin', 'segreteria'] },
    title: 'WhatsApp Gateway',
    children: [
      { path: '', redirectTo: 'monitor', pathMatch: 'full' },
      { path: 'monitor', component: WhatsappMonitorContainer, title: 'Monitor Messaggi' },
      { path: 'settings', component: WhatsappSettingsContainer, title: 'Configurazione WhatsApp' },
      { path: 'log-management', component: WhatsappLogManagementContainer, title: 'Gestione Log' },
    ],
  },

  // --- Redirect ---
  {
    path: '',
    redirectTo: '/calendar',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/calendar',
  },
];
