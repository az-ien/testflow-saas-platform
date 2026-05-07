import {
  DataTypes,
  Model,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';

export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type BillingInterval = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'paused';

export const PLAN_LIMITS: Record<PlanId, { runs: number; parallel: number; price: number }> = {
  free:       { runs: 50,     parallel: 1,  price: 0   },
  starter:    { runs: 500,    parallel: 2,  price: 29  },
  pro:        { runs: 5000,   parallel: 5,  price: 99  },
  business:   { runs: 25000,  parallel: 20, price: 299 },
  enterprise: { runs: 999999, parallel: 50, price: 0   }, // custom pricing
};

export class Subscription extends Model<
  InferAttributes<Subscription>,
  InferCreationAttributes<Subscription>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<string>;
  declare planId: PlanId;
  declare status: CreationOptional<SubscriptionStatus>;
  declare billingInterval: CreationOptional<BillingInterval>;
  declare stripeSubscriptionId: CreationOptional<string | null>;
  declare stripePriceId: CreationOptional<string | null>;
  declare currentPeriodStart: CreationOptional<Date | null>;
  declare currentPeriodEnd: CreationOptional<Date | null>;
  declare cancelAtPeriodEnd: CreationOptional<boolean>;
  declare trialEnd: CreationOptional<Date | null>;
  declare monthlyRunsLimit: CreationOptional<number>;
  declare parallelRunnersLimit: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Subscription.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    planId: {
      type: DataTypes.ENUM('free', 'starter', 'pro', 'business', 'enterprise'),
      allowNull: false,
      defaultValue: 'free',
    },
    status: {
      type: DataTypes.ENUM('active', 'past_due', 'cancelled', 'trialing', 'paused'),
      defaultValue: 'active',
    },
    billingInterval: {
      type: DataTypes.ENUM('monthly', 'yearly'),
      defaultValue: 'monthly',
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    stripePriceId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    currentPeriodStart: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    currentPeriodEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelAtPeriodEnd: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    trialEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    monthlyRunsLimit: {
      type: DataTypes.INTEGER,
      defaultValue: PLAN_LIMITS.free.runs,
    },
    parallelRunnersLimit: {
      type: DataTypes.INTEGER,
      defaultValue: PLAN_LIMITS.free.parallel,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'subscriptions',
    modelName: 'Subscription',
  }
);

export default Subscription;
