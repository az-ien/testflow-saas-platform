import { PlannerService } from './PlannerService';
import { HeuristicProvider } from '../providers/HeuristicProvider';

describe('PlannerService', () => {
  const planner = new PlannerService(new HeuristicProvider());

  it('creates login and acceptance-criteria scenarios from evidence instead of inventing payments', async () => {
    const scenarios = await planner.plan({
      requirementKey: 'GH-001',
      title: 'Successful Product Checkout',
      acceptanceCriteria: 'Login with valid credentials\nAdd Sauce Labs Backpack to the cart',
      applicationUrl: 'https://www.saucedemo.com',
      exploration: {
        startUrl: 'https://www.saucedemo.com',
        pages: [
          {
            url: 'https://www.saucedemo.com',
            title: 'Swag Labs',
            snapshot: 'Login',
            headings: ['Swag Labs'],
            interactiveElements: [
              { tag: 'input', name: 'user-name', placeholder: 'Username', testId: 'username' },
              { tag: 'input', type: 'password', testId: 'password' },
              { tag: 'button', text: 'Login', testId: 'login-button' },
              { tag: 'button', text: 'Add to cart', testId: 'add-to-cart-sauce-labs-backpack' },
            ],
          },
        ],
        observations: ['Login and inventory controls observed'],
        consoleMessages: [],
        networkErrors: [],
      },
    });

    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.some((item) => /login/i.test(item.title))).toBe(true);
    expect(scenarios.every((item) => !/credit card/i.test(item.title))).toBe(true);
    expect(scenarios[0].requirementRefs).toContain('GH-001');
  });
});
