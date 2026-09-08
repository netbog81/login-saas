/**
 * Sede operativa dello studio.
 *
 * Il clinico è il MASTER delle sedi: accounting ne tiene una replica con lo
 * stesso identificativo, allineata dall'evento `site.upserted`.
 *
 * `isDefault` — la sede principale, una sola per tenant. Lato contabile è
 * quella che usa la serie di numerazione GENERALE invece di una propria: è
 * il motivo per cui il flag esiste, e con una sede sola è sempre lei.
 */
export interface Site {
  id: string;
  name: string;
  address?: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSiteInput {
  name?: string;
  address?: string | null;
  isActive?: boolean;
}
