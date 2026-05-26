import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[auth]: JWT_SECRET is missing or too short (need >= 32 chars).');
  process.exit(1);
}

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload;
  }
}

export const signToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: '2h' });
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin role required' });
    return;
  }
  next();
};
