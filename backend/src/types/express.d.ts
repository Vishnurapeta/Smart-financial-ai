import { RoleName } from '../models/role.model.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: RoleName;
      };
      resource?: Record<string, unknown> | null;
    }
  }
}

export {};
