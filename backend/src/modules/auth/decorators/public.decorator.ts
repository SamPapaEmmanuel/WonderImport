import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Skips authentication for a route (health checks only). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
