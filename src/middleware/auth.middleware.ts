import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; clientId: string | null };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: string;
      clientId: string | null;
    };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  authMiddleware(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  });
}

export function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  authMiddleware(req, res, () => {
    if (req.user?.role !== 'CLIENT') {
      res.status(403).json({ message: 'Forbidden: CLIENT role required' });
      return;
    }
    next();
  });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  authMiddleware(req, res, next);
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(); // No token — continue as unauthenticated
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: string;
      clientId: string | null;
    };
    req.user = payload;
  } catch {
    // Invalid/expired token — treat as unauthenticated, don't block
  }

  next();
}

/**
 * Role guard middleware factory.
 * Usage: router.get('/route', guard('CLIENT', 'ADMIN'), handler)
 */
export function guard(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    authMiddleware(req, res, () => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ message: `Forbidden: requires one of [${roles.join(', ')}]` });
        return;
      }
      next();
    });
  };
}
