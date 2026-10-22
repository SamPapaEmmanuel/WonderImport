import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from './modules/auth/auth.controller';
import { IS_PUBLIC } from './modules/auth/decorators/public.decorator';
import { ROLES } from './modules/auth/decorators/roles.decorator';
import { CategoriesController } from './modules/categories/categories.controller';
import { ClientsController } from './modules/clients/clients.controller';
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { ExportsController } from './modules/exports/exports.controller';
import { GoodsController } from './modules/goods/goods.controller';
import { HealthController } from './modules/health/health.controller';
import { ImportsController } from './modules/imports/imports.controller';
import { LookupsController } from './modules/lookups/lookups.controller';
import { SettingsController } from './modules/settings/settings.controller';
import { SuppliersController } from './modules/suppliers/suppliers.controller';
import { UsersController } from './modules/users/users.controller';

/**
 * Every route and who may call it. This mirrors the role matrix in docs/PHASE-0-DECISIONS.md §4.
 * A new or changed route fails this test until its access rule is reviewed and added here.
 */
const EXPECTED: [string, string][] = [
  ['GET /auth/me', 'ANY_SIGNED_IN'],
  ['GET /auth/debug-token', 'PUBLIC'],
  ['GET /categories', 'ANY_SIGNED_IN'],
  ['POST /categories', 'ADMIN'],
  ['PATCH /categories/:id', 'ADMIN'],
  ['POST /categories/:id/archive', 'ADMIN'],
  ['POST /categories/:id/restore', 'ADMIN'],
  ['GET /clients', 'ANY_SIGNED_IN'],
  ['GET /clients/:id', 'ANY_SIGNED_IN'],
  ['POST /clients', 'ADMIN STAFF'],
  ['PATCH /clients/:id', 'ADMIN STAFF'],
  ['POST /clients/:id/archive', 'ADMIN STAFF'],
  ['POST /clients/:id/restore', 'ADMIN STAFF'],
  ['GET /dashboard/summary', 'ANY_SIGNED_IN'],
  ['GET /exports/goods', 'ADMIN STAFF'],
  ['GET /exports/clients', 'ADMIN STAFF'],
  ['GET /goods', 'ANY_SIGNED_IN'],
  ['GET /goods/:id', 'ANY_SIGNED_IN'],
  ['GET /goods/:id/history', 'ADMIN STAFF'],
  ['POST /goods', 'ADMIN STAFF'],
  ['PATCH /goods/:id', 'ADMIN STAFF'],
  ['PATCH /goods/:id/status', 'ADMIN STAFF'],
  ['PATCH /goods/:id/china-check-in', 'ADMIN STAFF'],
  ['POST /goods/:id/duplicate', 'ADMIN STAFF'],
  ['POST /goods/:id/allocations', 'ADMIN STAFF'],
  ['GET /goods/:id/allocations', 'ANY_SIGNED_IN'],
  ['POST /goods/:id/archive', 'ADMIN STAFF'],
  ['POST /goods/:id/restore', 'ADMIN STAFF'],
  ['GET /health', 'PUBLIC'],
  ['GET /imports/template', 'ADMIN STAFF'],
  ['GET /imports', 'ADMIN STAFF'],
  ['POST /imports', 'ADMIN STAFF'],
  ['GET /imports/:id', 'ADMIN STAFF'],
  ['POST /imports/:id/commit', 'ADMIN STAFF'],
  ['POST /imports/:id/archive-goods', 'ADMIN'],
  ['POST /imports/:id/cancel', 'ADMIN STAFF'],
  ['GET /imports/:id/errors', 'ADMIN STAFF'],
  ['GET /lookups', 'ANY_SIGNED_IN'],
  ['GET /settings/pricing', 'ANY_SIGNED_IN'],
  ['PATCH /settings/pricing', 'ADMIN'],
  ['GET /suppliers', 'ANY_SIGNED_IN'],
  ['POST /suppliers', 'ADMIN'],
  ['PATCH /suppliers/:id', 'ADMIN'],
  ['POST /suppliers/:id/archive', 'ADMIN'],
  ['POST /suppliers/:id/restore', 'ADMIN'],
  ['GET /users', 'ADMIN'],
  ['POST /users', 'ADMIN'],
  ['PATCH /users/:id', 'ADMIN'],
  ['POST /users/:id/invite', 'ADMIN'],
];

const CONTROLLERS = [
  AuthController, CategoriesController, ClientsController, DashboardController, ExportsController, GoodsController,
  HealthController, ImportsController, LookupsController, SettingsController, SuppliersController, UsersController,
];

function actualRoutes(): [string, string][] {
  const out: [string, string][] = [];
  for (const ctrl of CONTROLLERS) {
    const base = Reflect.getMetadata(PATH_METADATA, ctrl) as string;
    const classRoles = Reflect.getMetadata(ROLES, ctrl) as string[] | undefined;
    for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
      const handler = (ctrl.prototype as Record<string, any>)[name];
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined || name === 'constructor') continue;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const path = `/${[base, sub].filter((p) => p && p !== '/').join('/')}`.replace(/\/+/g, '/');
      const isPublic = Reflect.getMetadata(IS_PUBLIC, handler) ?? Reflect.getMetadata(IS_PUBLIC, ctrl);
      const roles = (Reflect.getMetadata(ROLES, handler) as string[] | undefined) ?? classRoles;
      const access = isPublic ? 'PUBLIC' : roles?.length ? [...roles].sort().join(' ') : 'ANY_SIGNED_IN';
      out.push([`${RequestMethod[method]} ${path}`, access]);
    }
  }
  return out;
}

describe('route access', () => {
  const actual = actualRoutes();

  it('matches the reviewed access matrix exactly', () => {
    const sort = (l: [string, string][]) => [...l].sort((a, b) => a[0].localeCompare(b[0]));
    expect(sort(actual)).toEqual(sort(EXPECTED));
  });

  it('never lets viewers change data', () => {
    const offending = actual.filter(([route, access]) => !route.startsWith('GET ') && /ANY_SIGNED_IN|VIEWER|PUBLIC/.test(access));
    expect(offending).toEqual([]);
  });

  it('keeps only the health check and the temporary token debugger public', () => {
    expect(actual.filter(([, a]) => a === 'PUBLIC').map(([r]) => r)).toEqual(['GET /auth/debug-token', 'GET /health']);
  });
});
