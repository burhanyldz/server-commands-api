import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { type Request, type Response } from 'express';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import UserModel from '../models/user.model.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const issueJwt = (userId: string, role: 'admin' | 'operator'): string => {
  const opts: SignOptions = { subject: userId, expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign({ role }, env.jwtSecret, opts);
};

const issuePasskeyChallengeToken = (userId: string, challenge: string): string => {
  const opts: SignOptions = { subject: userId, expiresIn: '5m' };
  return jwt.sign({ type: 'passkey-challenge', challenge }, env.jwtSecret, opts);
};

// ─── Validation schemas ───────────────────────────────────────────────────────

const loginOptionsSchema = z.object({ email: z.string().email() });

const loginVerifySchema = z.object({
  challengeToken: z.string().min(1),
  authenticationResponse: z.any()
});

const registerVerifySchema = z.object({
  challengeToken: z.string().min(1),
  registrationResponse: z.any(),
  passkeyName: z.string().max(64).optional()
});

const deletePasskeyParamsSchema = z.object({ credentialId: z.string().min(1) });

// ─── Registration (authenticated) ────────────────────────────────────────────

/** GET /api/auth/passkey/register-options — must be logged in */
export const passkeyRegisterOptions = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ message: 'Unauthorized.' }); return; }

  const user = await UserModel.findById(req.auth.userId);
  if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

  const options = await generateRegistrationOptions({
    rpName: env.webauthnRpName,
    rpID: env.webauthnRpId,
    userName: user.email,
    userDisplayName: user.email,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map((pk) => ({
      id: pk.credentialID,
      transports: pk.transports as AuthenticatorTransportFuture[]
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred'
    }
  });

  const challengeToken = issuePasskeyChallengeToken(String(user._id), options.challenge);
  res.json({ options, challengeToken });
};

/** POST /api/auth/passkey/register-verify — must be logged in */
export const passkeyRegisterVerify = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ message: 'Unauthorized.' }); return; }

  const parsed = registerVerifySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid payload.' }); return; }

  const { challengeToken, registrationResponse, passkeyName } = parsed.data;

  let payload: JwtPayload;
  try {
    payload = jwt.verify(challengeToken, env.jwtSecret) as JwtPayload;
  } catch {
    res.status(401).json({ message: 'Challenge token is invalid or expired.' });
    return;
  }

  if (payload['type'] !== 'passkey-challenge' || !payload.sub || payload.sub !== req.auth.userId) {
    res.status(401).json({ message: 'Challenge token is invalid.' });
    return;
  }

  const user = await UserModel.findById(req.auth.userId);
  if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: payload['challenge'] as string,
      expectedOrigin: env.webauthnOrigin,
      expectedRPID: env.webauthnRpId,
      requireUserVerification: false
    });
  } catch (err) {
    res.status(400).json({ message: `Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    return;
  }

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ message: 'Registration verification failed.' });
    return;
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  user.passkeys.push({
    credentialID: credential.id,
    credentialPublicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: (registrationResponse.response?.transports ?? []) as string[],
    name: passkeyName?.trim() || 'Passkey',
    createdAt: new Date()
  });

  await user.save();
  res.json({ message: 'Passkey registered successfully.' });
};

// ─── Authentication (public) ──────────────────────────────────────────────────

/** POST /api/auth/passkey/login-options — no auth required */
export const passkeyLoginOptions = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginOptionsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Email is required.' }); return; }

  const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user || user.passkeys.length === 0) {
    res.status(404).json({ message: 'No passkeys registered for this account.' });
    return;
  }

  const options = await generateAuthenticationOptions({
    rpID: env.webauthnRpId,
    userVerification: 'preferred',
    allowCredentials: user.passkeys.map((pk) => ({
      id: pk.credentialID,
      transports: pk.transports as AuthenticatorTransportFuture[]
    }))
  });

  const challengeToken = issuePasskeyChallengeToken(String(user._id), options.challenge);
  res.json({ options, challengeToken });
};

/** POST /api/auth/passkey/login-verify — no auth required */
export const passkeyLoginVerify = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginVerifySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid payload.' }); return; }

  const { challengeToken, authenticationResponse } = parsed.data;

  let payload: JwtPayload;
  try {
    payload = jwt.verify(challengeToken, env.jwtSecret) as JwtPayload;
  } catch {
    res.status(401).json({ message: 'Challenge token is invalid or expired.' });
    return;
  }

  if (payload['type'] !== 'passkey-challenge' || !payload.sub) {
    res.status(401).json({ message: 'Challenge token is invalid.' });
    return;
  }

  const user = await UserModel.findById(payload.sub);
  if (!user) { res.status(401).json({ message: 'User not found.' }); return; }

  const passkey = user.passkeys.find((pk) => pk.credentialID === authenticationResponse.id);
  if (!passkey) { res.status(401).json({ message: 'Passkey not recognized.' }); return; }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: payload['challenge'] as string,
      expectedOrigin: env.webauthnOrigin,
      expectedRPID: env.webauthnRpId,
      credential: {
        id: passkey.credentialID,
        publicKey: isoBase64URL.toBuffer(passkey.credentialPublicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[]
      },
      requireUserVerification: false
    });
  } catch (err) {
    res.status(401).json({ message: `Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    return;
  }

  if (!verification.verified) {
    res.status(401).json({ message: 'Authentication failed.' });
    return;
  }

  // Update the stored counter to prevent replay attacks
  passkey.counter = verification.authenticationInfo.newCounter;
  await user.save();

  const token = issueJwt(String(user._id), user.role);
  res.json({
    token,
    user: {
      id: String(user._id),
      email: user.email,
      role: user.role,
      totpEnabled: user.totpEnabled ?? false
    }
  });
};

// ─── Passkey management (authenticated) ──────────────────────────────────────

/** GET /api/auth/passkey/list — must be logged in */
export const passkeyList = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ message: 'Unauthorized.' }); return; }

  const user = await UserModel.findById(req.auth.userId).lean();
  if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

  res.json({
    passkeys: user.passkeys.map((pk) => ({
      id: pk.credentialID,
      name: pk.name,
      deviceType: pk.deviceType,
      backedUp: pk.backedUp,
      createdAt: pk.createdAt
    }))
  });
};

/** DELETE /api/auth/passkey/:credentialId — must be logged in */
export const passkeyDelete = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ message: 'Unauthorized.' }); return; }

  const parsed = deletePasskeyParamsSchema.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ message: 'Credential ID is required.' }); return; }

  const user = await UserModel.findById(req.auth.userId);
  if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

  const idx = user.passkeys.findIndex((pk) => pk.credentialID === parsed.data.credentialId);
  if (idx === -1) { res.status(404).json({ message: 'Passkey not found.' }); return; }

  user.passkeys.splice(idx, 1);
  await user.save();
  res.json({ message: 'Passkey removed.' });
};
