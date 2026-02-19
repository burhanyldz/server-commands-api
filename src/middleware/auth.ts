import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface AuthTokenPayload {
  sub: string;
  role: 'admin' | 'operator';
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: 'Authorization token is required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;

    req.auth = {
      userId: decoded.sub,
      role: decoded.role
    };

    next();
  } catch (_error) {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ message: 'Admin role is required.' });
    return;
  }

  next();
};
