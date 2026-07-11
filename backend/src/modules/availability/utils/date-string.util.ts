/**
 * Normalizza Date|string a 'YYYY-MM-DD' con parti locali, stessa convenzione
 * con cui TypeORM scrive le colonne Postgres `date`
 * (DateUtils.mixedDateToDateString): il valore restituito al client GraphQL
 * deve coincidere con quello persistito.
 *
 * Contesto: le colonne `date` sono esposte come `@Field(() => String)` perché
 * TypeORM le idrata come stringhe e GraphQLISODateTime.serialize restituisce
 * null per tutto ciò che non è instanceof Date. Le entity appena salvate però
 * conservano il valore passato a create()/save() — se è un Date vivo,
 * GraphQLString lo serializzerebbe come epoch millis via valueOf(). Da qui la
 * necessità di normalizzare nei percorsi di scrittura che restituiscono
 * l'entity al client.
 */
export function toDateString(value: Date | string): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}
