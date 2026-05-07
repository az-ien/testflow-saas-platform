import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { logger } from '../config/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const API_KEY_HEADER = 'x-api-key';

export interface AuthPayload {
  userId: string;
  email: string;
  tier: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      apiKeyUser?: User;
    }
  }
}

// ─── JWT Auth ─────────────────────────────────────────────────────────────────
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    logger.warn('JWT verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── API Key Auth ─────────────────────────────────────────────────────────────
export const authenticateAPIKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.headers[API_KEY_HEADER] as string;
  if (!apiKey) {
    res.status(401).json({ error: 'API key required. Pass X-API-Key header.' });
    return;
  }

  try {
    const user = await User.findOne({ where: { apiKey } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid or inactive API key' });
      return;
    }
    // Attach user to request so routes can check subscription tier
    req.apiKeyUser = user;
    req.user = {
      userId: user.id,
      email: user.email,
      tier: user.subscriptionTier,
    };
    next();
  } catch (err) {
    logger.error('API key auth error:', err);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// ─── Either Auth (JWT or API Key) ────────────────────────────────────────────
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.headers[API_KEY_HEADER]) {
    return authenticateAPIKey(req, res, next);
  }
  return authenticateJWT(req, res, next);
};

// ─── Token Generation ─────────────────────────────────────────────────────────
export const generateTokens = (payload: AuthPayload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
};
