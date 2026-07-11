import { Routes } from '@angular/router';

import { DocumentTemplatesPageContainer } from './containers/document-templates-page.container';
import { DocumentTemplateEditorContainer } from './containers/document-template-editor.container';

export const DOCUMENT_TEMPLATES_ROUTES: Routes = [
  { path: '', component: DocumentTemplatesPageContainer, title: 'Template documenti' },
  { path: 'new', component: DocumentTemplateEditorContainer, title: 'Nuovo template' },
  { path: ':id', component: DocumentTemplateEditorContainer, title: 'Modifica template' },
];
