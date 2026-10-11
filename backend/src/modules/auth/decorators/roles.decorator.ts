import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../../generated/prisma/enums';

export const ROLES = 'roles';
/** Restricts a route to the listed roles. Routes without @Roles are open to any signed-in user. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
