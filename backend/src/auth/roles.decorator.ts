import { SetMetadata } from '@nestjs/common';
import { AppUserRole } from '../entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppUserRole[]) => SetMetadata(ROLES_KEY, roles);
