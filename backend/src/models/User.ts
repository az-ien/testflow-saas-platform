import {
  DataTypes,
  Model,
  Optional,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare passwordHash: string;
  declare firstName: string;
  declare lastName: string;
  declare company: CreationOptional<string>;
  declare apiKey: CreationOptional<string>;
  declare subscriptionTier: CreationOptional<SubscriptionTier>;
  declare isActive: CreationOptional<boolean>;
  declare isEmailVerified: CreationOptional<boolean>;
  declare emailVerificationToken: CreationOptional<string | null>;
  declare passwordResetToken: CreationOptional<string | null>;
  declare passwordResetExpires: CreationOptional<Date | null>;
  declare refreshToken: CreationOptional<string | null>;
  declare stripeCustomerId: CreationOptional<string | null>;
  declare monthlyRunsUsed: CreationOptional<number>;
  declare monthlyRunsLimit: CreationOptional<number>;
  declare lastLoginAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Virtual: full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }

  toSafeJSON() {
    const { passwordHash, refreshToken, emailVerificationToken, passwordResetToken, ...safe } =
      this.toJSON() as any;
    return safe;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    apiKey: {
      type: DataTypes.STRING(64),
      unique: true,
      defaultValue: () => `tf_${uuidv4().replace(/-/g, '')}`,
    },
    subscriptionTier: {
      type: DataTypes.ENUM('free', 'starter', 'pro', 'business', 'enterprise'),
      defaultValue: 'free',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    emailVerificationToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    stripeCustomerId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    monthlyRunsUsed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    monthlyRunsLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 50, // free tier
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'users',
    modelName: 'User',
    hooks: {
      beforeCreate: async (user) => {
        if (user.passwordHash) {
          user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
        }
      },
    },
  }
);

export default User;
