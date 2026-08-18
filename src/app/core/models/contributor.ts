/**
 * Vista pubblica di chi ha caricato contenuti, per il filtro per persona in galleria.
 * Non contiene il pensiero lasciato agli sposi: quello resta nelle API admin.
 */
export interface Contributor {
  id: string;
  displayName: string;
  uploadCount: number;
}
