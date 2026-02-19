import bcrypt from 'bcryptjs';
import { type Request, type Response } from 'express';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
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

const completeTotpLoginSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(6).max(8)
});

const confirmTotpSchema = z.object({
  code: z.string().min(6).max(8)
});

const disableTotpSchema = z.object({
  code: z.string().min(6).max(8)
});

const issueToken = (userId: string, role: 'admin' | 'operator'): string => {
  const signOptions: SignOptions = {
    subject: userId,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn']
  };

  return jwt.sign({ role }, env.jwtSecret, signOptions);
};

const issueChallengeToken = (userId: string): string => {
  const signOptions: SignOptions = {
    subject: userId,
    expiresIn: '5m'
  };

  return jwt.sign({ type: 'totp-challenge' }, env.jwtSecret, signOptions);
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
      role: user.role,
      totpEnabled: false
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

  // 2FA is enabled — issue a short-lived challenge token instead of the full JWT
  if (user.totpEnabled) {
    const challengeToken = issueChallengeToken(String(user._id));
    res.status(200).json({ requiresTwoFactor: true, challengeToken });
    return;
  }

  const token = issueToken(String(user._id), user.role);

  res.status(200).json({
    token,
    user: {
      id: String(user._id),
      email: user.email,
      role: user.role,
      totpEnabled: false
    }
  });
};

// Step-2 of login when 2FA is active
export const completeTotpLogin = async (req: Request, res: Response): Promise<void> => {
  const parsed = completeTotpLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload.', details: parsed.error.flatten() });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(parsed.data.challengeToken, env.jwtSecret) as JwtPayload;
  } catch {
    res.status(401).json({ message: 'Challenge token is invalid or expired.' });
    return;
  }

  if (payload['type'] !== 'totp-challenge' || !payload.sub) {
    res.status(401).json({ message: 'Challenge token is invalid.' });
    return;
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(401).json({ message: 'Invalid request.' });
    return;
  }

  const isValidCode = authenticator.verify({ token: parsed.data.code, secret: user.totpSecret });
  if (!isValidCode) {
    res.status(401).json({ message: 'Invalid authenticator code.' });
    return;
  }

  const token = issueToken(String(user._id), user.role);

  res.status(200).json({
    token,
    user: {
      id: String(user._id),
      email: user.email,
      role: user.role,
      totpEnabled: true
    }
  });
};

// Generates a new TOTP secret and returns a QR code (does NOT enable 2FA yet)
export const setupTotp = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const user = await UserModel.findById(req.auth.userId);
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  if (user.totpEnabled) {
    res.status(409).json({ message: '2FA is already enabled. Disable it first.' });
    return;
  }

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, 'Server Commands', secret);
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  // Persist the pending secret (not yet confirmed)
  user.totpSecret = secret;
  await user.save();

  res.status(200).json({ secret, qrCodeDataUrl });
};

// Confirms TOTP setup by verifying the first code from the authenticator app
export const confirmTotp = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parsed = confirmTotpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload.', details: parsed.error.flatten() });
    return;
  }

  const user = await UserModel.findById(req.auth.userId);
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  if (user.totpEnabled) {
    res.status(409).json({ message: '2FA is already enabled.' });
    return;
  }

  if (!user.totpSecret) {
    res.status(400).json({ message: 'Run 2FA setup first to get a secret.' });
    return;
  }

  const isValid = authenticator.verify({ token: parsed.data.code, secret: user.totpSecret });
  if (!isValid) {
    res.status(401).json({ message: 'Invalid authenticator code. Make sure the code is current.' });
    return;
  }

  user.totpEnabled = true;
  await user.save();

  res.status(200).json({ message: '2FA has been enabled successfully.' });
};

// Disables 2FA after verifying the current TOTP code
export const disableTotp = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parsed = disableTotpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload.', details: parsed.error.flatten() });
    return;
  }

  const user = await UserModel.findById(req.auth.userId);
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  if (!user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ message: '2FA is not enabled on this account.' });
    return;
  }

  const isValid = authenticator.verify({ token: parsed.data.code, secret: user.totpSecret });
  if (!isValid) {
    res.status(401).json({ message: 'Invalid authenticator code.' });
    return;
  }

  user.totpEnabled = false;
  user.totpSecret = null;
  await user.save();

  res.status(200).json({ message: '2FA has been disabled.' });
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
      role: user.role,
      totpEnabled: user.totpEnabled ?? false
    }
  });
};


