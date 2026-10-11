import type { Role } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  STAFF: 'Staff',
  VIEWER: 'Viewer',
};

/** UI-side permission hints. The API remains the authority and re-checks every request. */
export const can = {
  editGoods: (r?: Role) => r === 'ADMIN' || r === 'STAFF',
  correctShipment: (r?: Role) => r === 'ADMIN',
  manageMasterData: (r?: Role) => r === 'ADMIN',
  manageSettings: (r?: Role) => r === 'ADMIN',
  importExport: (r?: Role) => r === 'ADMIN' || r === 'STAFF',
};
