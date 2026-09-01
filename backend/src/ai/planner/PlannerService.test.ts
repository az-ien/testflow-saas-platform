import { PlannerService } from './PlannerService';
import { HeuristicProvider } from '../providers/HeuristicProvider';
import { classifyScenario } from '../validator/classification';

const loginExploration = {
  startUrl: 'https://shop.example.com',
  pages: [
    {
      url: 'https://shop.example.com',
      title: 'Catalog Login',
      snapshot: 'Username Password Login',
      headings: ['Catalog Login'],
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
};

describe('PlannerService', () => {
  const planner = new PlannerService(new HeuristicProvider());

  it('plans login and observed cart controls from evidence and does not invent payments', async () => {
    const scenarios = await planner.plan({
      requirementKey: 'GH-001',
      title: 'Successful Product Checkout',
      acceptanceCriteria: 'Login with valid credentials\nAdd Sauce Labs Backpack to the cart',
      applicationUrl: 'https://shop.example.com',
      exploration: loginExploration,
    });

    expect(scenarios.some((item) => /login/i.test(item.title))).toBe(true);
    expect(scenarios.some((item) => /backpack|add to cart/i.test(item.title))).toBe(true);
    expect(scenarios.every((item) => !/credit card/i.test(item.title))).toBe(true);
    const login = scenarios.find((item) => /login/i.test(item.title))!;
    expect(login.evidenceRefs.some((ref) => /username|password|login/i.test(ref))).toBe(true);
    expect(login.evidenceRefs.every((ref) => !/^https?:\/\//i.test(ref))).toBe(true);
    expect(login.requirementRefs).toContain('GH-001');
  });

  it('keeps unverified acceptance criteria instead of pretending the UI exists', async () => {
    const scenarios = await planner.plan({
      requirementKey: 'GH-002',
      title: 'Hallucination challenge',
      acceptanceCriteria: 'Enter credit-card details\nApply a discount code\nVerify an email receipt',
      applicationUrl: 'https://shop.example.com',
      exploration: loginExploration,
    });

    const invented = scenarios.filter((item) => /credit-card|discount code|email receipt/i.test(item.title));
    expect(invented.length).toBeGreaterThan(0);
    invented.forEach((item) => {
      expect(item.evidenceRefs).toEqual([]);
      expect(classifyScenario(item, {
        title: 'Hallucination challenge',
        description: 'Do not invent checkout payment fields',
        acceptanceCriteria: 'Enter credit-card details\nApply a discount code\nVerify an email receipt',
      }, loginExploration).classification).toBe('UNSUPPORTED');
    });
  });

  it('does not treat a missing checkout flow as observed when only a login form was found', async () => {
    const scenarios = await planner.plan({
      requirementKey: 'REQ-9',
      title: 'Complete checkout',
      acceptanceCriteria: 'Complete the order and confirm success',
      exploration: {
        startUrl: 'https://shop.example.com',
        pages: [
          {
            url: 'https://shop.example.com',
            title: 'Login',
            snapshot: 'Username Password',
            headings: ['Login'],
            interactiveElements: [
              { tag: 'input', type: 'password', testId: 'password' },
              { tag: 'input', placeholder: 'Username', testId: 'username' },
              { tag: 'button', text: 'Login', testId: 'login-button' },
            ],
          },
        ],
        observations: ['Login form observed; credentials were not provided'],
        consoleMessages: [],
        networkErrors: [],
      },
    });

    const checkout = scenarios.find((item) => /complete the order/i.test(item.title));
    expect(checkout).toBeDefined();
    expect(checkout!.evidenceRefs).toEqual([]);
    expect(checkout!.assumptions.length).toBeGreaterThan(0);
    expect(classifyScenario(checkout!, {
      title: 'Complete checkout',
      acceptanceCriteria: 'Complete the order and confirm success',
    }, {
      startUrl: 'https://shop.example.com',
      pages: [
        {
          url: 'https://shop.example.com',
          title: 'Login',
          snapshot: 'Username Password',
          headings: ['Login'],
          interactiveElements: [
            { tag: 'input', type: 'password', testId: 'password' },
            { tag: 'button', text: 'Login', testId: 'login-button' },
          ],
        },
      ],
      observations: [],
      consoleMessages: [],
      networkErrors: [],
    }).classification).toBe('NEEDS_REVIEW');
  });
});
