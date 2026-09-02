import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { Organization, OrganizationMember } from '../models/Organization';
import { User } from '../models/User';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  next();
};

const requireMembership = async (organizationId: string, userId: string) => {
  const org = await Organization.findByPk(organizationId);
  if (!org) throw new NotFoundError('Organization');
  const member = await OrganizationMember.findOne({ where: { organizationId, userId } });
  if (!member) throw new ForbiddenError('Not a member of this organization');
  return { org, member };
};

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memberships = await OrganizationMember.findAll({
      where: { userId: req.user!.userId },
      include: [{ association: 'organization' }],
    });
    res.json({ organizations: memberships });
  } catch (err) { next(err); }
});

router.post(
  '/',
  [body('name').trim().notEmpty().isLength({ max: 200 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await Organization.create({ name: req.body.name, ownerUserId: req.user!.userId });
      await OrganizationMember.create({ organizationId: org.id, userId: req.user!.userId, role: 'owner' });
      await User.update({ organizationId: org.id }, { where: { id: req.user!.userId, organizationId: null } });
      res.status(201).json(org);
    } catch (err) { next(err); }
  }
);

router.post(
  '/:id/members',
  [body('email').isEmail(), body('role').optional().isIn(['admin', 'member'])],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { org, member } = await requireMembership(req.params.id, req.user!.userId);
      if (!['owner', 'admin'].includes(member.role)) throw new ForbiddenError('Only owners and admins can invite');
      const user = await User.findOne({ where: { email: req.body.email.toLowerCase() } });
      if (!user) throw new ValidationError('No TestFlow user with that email');
      const [row] = await OrganizationMember.findOrCreate({
        where: { organizationId: org.id, userId: user.id },
        defaults: { organizationId: org.id, userId: user.id, role: req.body.role || 'member' },
      });
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

export default router;
