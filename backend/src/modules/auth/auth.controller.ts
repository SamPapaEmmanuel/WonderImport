import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  /** The signed-in user and their role. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { data: user };
  }
}
