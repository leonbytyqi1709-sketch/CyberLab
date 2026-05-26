import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/neon';
import { signToken } from '../middleware/auth';
import { writeAudit } from '../services/auditLog';

const getClientIp = (req: Request): string => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const ip = getClientIp(req);

  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      await writeAudit({
        actor: `user:${email}`,
        actionType: 'LOGIN_FAILURE',
        outcome: 'FAILURE',
        details: { reason: 'user_not_found' },
        ipAddress: ip,
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      await writeAudit({
        actor: `user:${email}`,
        actionType: 'LOGIN_FAILURE',
        outcome: 'FAILURE',
        details: { reason: 'invalid_password' },
        ipAddress: ip,
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    await writeAudit({
      actor: `user:${user.email}`,
      actionType: 'LOGIN_SUCCESS',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ip,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
      expiresIn: 2 * 60 * 60,
    });
  } catch (error) {
    console.error('[auth]: login failed', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({
    user: {
      id: req.auth.sub,
      email: req.auth.email,
      role: req.auth.role,
    },
  });
};
