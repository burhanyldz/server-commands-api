import bcrypt from 'bcryptjs';
import { type Request, type Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import UserModel from '../models/user.model.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const bootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  bootstrapToken: z.string().optional()
});

const issueToken = (userId: string, role: 'admin' | 'operator'): string => {
  const signOptions: SignOptions = {
    subject: userId,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn']
  };

  return jwt.sign({ role }, env.jwtSecret, signOptions);
};

export const bootstrapAdmin = async (req: Request, res: Response): Promise<void> => {
  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid bootstrap payload.', details: parsed.error.flatten() });
    return;
  }

  if (!env.bootstrapToken) {
    res.status(503).json({ message: 'BOOTSTRAP_TOKEN is not configured in API environment.' });
    return;
  }

  const providedToken = req.header('x-bootstrap-token') ?? parsed.data.bootstrapToken;
  if (providedToken !== env.bootstrapToken) {
    res.status(401).json({ message: 'Bootstrap token is invalid.' });
    return;
  }

  const existingUsers = await UserModel.countDocuments();
  if (existingUsers > 0) {
    res.status(409).json({ message: 'Bootstrap can only be used before the first user is created.' });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, env.bcryptRounds);
  const user = await UserModel.create({
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    role: 'admin'
  });

  const token = issueToken(String(user._id), user.role);

  res.status(201).json({
    token,
    user: {
      id: String(user._id),
      email: user.email,
      role: user.role
    }
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid login payload.', details: parsed.error.flatten() });
    return;
  }

  const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const token = issueToken(String(user._id), user.role);

  res.status(200).json({
    token,
    user: {
      id: String(user._id),
      email: user.email,
      role: user.role
    }
  });
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const user = await UserModel.findById(req.auth.userId).lean();
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  res.status(200).json({
    user: {
      id: String(user._id),
      email: user.email,
      role: user.role
    }
  });
};
