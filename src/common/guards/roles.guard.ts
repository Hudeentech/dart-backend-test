import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: user role not determined');
    }

    // Admins always have access to protected role endpoints
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Direct role match
    if (requiredRoles.includes(user.role)) {
      return true;
    }

    // Unified account cross-role access:
    // A DART user can use any account type (Customer & Rider).
    // If an endpoint allows CUSTOMER or RIDER, and the user is either CUSTOMER or RIDER, allow access.
    const isEndUserRole = (r: UserRole) => r === UserRole.CUSTOMER || r === UserRole.RIDER;
    const allowsEndUser = requiredRoles.some(isEndUserRole);
    if (isEndUserRole(user.role) && allowsEndUser) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied: required role in [${requiredRoles.join(', ')}]`,
    );
  }
}
