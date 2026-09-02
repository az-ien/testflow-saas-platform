import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User';
import { Subscription, PLAN_LIMITS } from '../models/Subscription';
import { generateTokens, verifyRefreshToken } from '../middleware/auth';
import { cache } from '../config/redis';
import { logger } from '../config/logger';
import { AppError, UnauthorizedError, ValidationError } from '../middleware/errorHandler';
import { Organization, OrganizationMember } from '../models/Organization';
import { emailVerificationEnabled, sendEmail } from './Mailer';

interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
}

interface LoginDTO {
  email: string;
  password: string;
}

export class AuthService {
  // ─── Register ──────────────────────────────────────────────────────────────
  async register(dto: RegisterDTO) {
    const existing = await User.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ValidationError('An account with this email already exists');

    const user = await User.create({
      email: dto.email.toLowerCase(),
      passwordHash: dto.password, // hashed in beforeCreate hook
      firstName: dto.firstName,
      lastName: dto.lastName,
      company: dto.company,
      emailVerificationToken: uuidv4(),
      subscriptionTier: 'free',
      monthlyRunsLimit: PLAN_LIMITS.free.runs,
    });

    // Create default free subscription
    await Subscription.create({
      userId: user.id,
      planId: 'free',
      status: 'active',
      monthlyRunsLimit: PLAN_LIMITS.free.runs,
      parallelRunnersLimit: PLAN_LIMITS.free.parallel,
    });

    const organization = await Organization.create({
      name: dto.company || `${dto.firstName}'s workspace`,
      ownerUserId: user.id,
    });
    await OrganizationMember.create({ organizationId: organization.id, userId: user.id, role: 'owner' });
    await user.update({ organizationId: organization.id });

    if (emailVerificationEnabled() && user.emailVerificationToken) {
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${user.emailVerificationToken}`;
      await sendEmail({
        to: user.email,
        subject: 'Verify your TestFlow email',
        text: `Confirm your email: ${verifyUrl}`,
        html: `<p>Confirm your email: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
      });
    }

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      tier: user.subscriptionTier!,
    });

    await user.update({ refreshToken: tokens.refreshToken });
    logger.info(`New user registered: ${user.email}`);

    return { user: user.toSafeJSON(), ...tokens };
  }

  // ─── Login ─────────────────────────────────────────────────────────────────
  async login(dto: LoginDTO) {
    const user = await User.findOne({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await user.validatePassword(dto.password))) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated. Contact support.');
    }
    if (emailVerificationEnabled() && !user.isEmailVerified) {
      throw new UnauthorizedError('Email is not verified. Check your inbox.');
    }

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      tier: user.subscriptionTier!,
    });

    await user.update({
      refreshToken: tokens.refreshToken,
      lastLoginAt: new Date(),
    });

    // Cache user session
    await cache.set(`session:${user.id}`, { userId: user.id, tier: user.subscriptionTier }, 900);

    return { user: user.toSafeJSON(), ...tokens };
  }

  // ─── Refresh Token ─────────────────────────────────────────────────────────
  async refreshToken(token: string) {
    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await User.findByPk(payload.userId);
    if (!user || user.refreshToken !== token) {
      throw new UnauthorizedError('Refresh token revoked');
    }

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      tier: user.subscriptionTier!,
    });

    await user.update({ refreshToken: tokens.refreshToken });
    return tokens;
  }

  // ─── Logout ────────────────────────────────────────────────────────────────
  async logout(userId: string) {
    await User.update({ refreshToken: null }, { where: { id: userId } });
    await cache.del(`session:${userId}`);
  }

  // ─── Regenerate API Key ────────────────────────────────────────────────────
  async regenerateApiKey(userId: string) {
    const newKey = `tf_${uuidv4().replace(/-/g, '')}`;
    await User.update({ apiKey: newKey }, { where: { id: userId } });
    logger.info(`API key regenerated for user: ${userId}`);
    return { apiKey: newKey };
  }

  async verifyEmail(token: string) {
    const user = await User.findOne({ where: { emailVerificationToken: token } });
    if (!user) throw new ValidationError('Invalid or expired verification token');
    await user.update({ isEmailVerified: true, emailVerificationToken: null });
    return { message: 'Email verified' };
  }

  // ─── Get Profile ───────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await User.findByPk(userId, {
      include: [{ association: 'subscription' }],
    });
    if (!user) throw new AppError('User not found', 404);
    return user.toSafeJSON();
  }
}

export default new AuthService();
