export interface User {
  id: number;
  name: string;
  type: string;
  color: string;
  active: boolean;
  operatorId?: string; // UUID dell'operatore per query GraphQL
  hasTemplate?: boolean; // True se l'operatore ha un template assegnato attivo
}
