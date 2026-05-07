import { User } from './User';
import { Project } from './Project';
import { TestRun } from './TestRun';
import { Subscription } from './Subscription';

// ─── Associations ─────────────────────────────────────────────────────────────

// User → Projects (one-to-many)
User.hasMany(Project, { foreignKey: 'userId', as: 'projects', onDelete: 'CASCADE' });
Project.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User → Subscription (one-to-one)
User.hasOne(Subscription, { foreignKey: 'userId', as: 'subscription', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User → TestRuns (one-to-many)
User.hasMany(TestRun, { foreignKey: 'userId', as: 'testRuns', onDelete: 'CASCADE' });
TestRun.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Project → TestRuns (one-to-many)
Project.hasMany(TestRun, { foreignKey: 'projectId', as: 'runs', onDelete: 'CASCADE' });
TestRun.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

export { User, Project, TestRun, Subscription };
