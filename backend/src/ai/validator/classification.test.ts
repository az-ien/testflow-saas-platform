import { classifyScenario } from './classification';
import { PlannedScenario } from '../types';

const requirement = {
  title: 'Successful Product Checkout',
  description: 'User can log in, add a backpack to the cart, and complete checkout.',
  acceptanceCriteria: 'Login with valid credentials\nAdd Sauce Labs Backpack to the cart\nComplete the order',
};

const exploration = {
  startUrl: 'https://shop.example.com',
  pages: [
    {
      url: 'https://shop.example.com',
      title: 'Catalog Login',
      snapshot: 'Username Password Login',
      interactiveElements: [
        { tag: 'input', name: 'username', placeholder: 'Username', testId: 'username' },
        { tag: 'input', name: 'password', type: 'password', testId: 'password' },
        { tag: 'button', text: 'Login', testId: 'login-button' },
      ],
      headings: ['Catalog Login'],
    },
  ],
  observations: ['Observed login form'],
  consoleMessages: [],
  networkErrors: [],
};

const scenario = (overrides: Partial<PlannedScenario>): PlannedScenario => ({
  scenarioKey: 'GH-001-SC01',
  title: 'Login with valid credentials',
  description: 'Authenticate using the login form',
  steps: [{ order: 1, action: 'Enter username', target: 'testid:username' }],
  expectedResult: 'Products page is shown',
  requirementRefs: ['GH-001'],
  evidenceRefs: ['testid:username', 'testid:password', 'testid:login-button'],
  assumptions: [],
  rationale: 'Login form was observed',
  ...overrides,
});

describe('Hallucination / evidence validator', () => {
  it('classifies evidenced requirement scenarios as VERIFIED', () => {
    const result = classifyScenario(scenario({}), requirement, exploration);
    expect(result.classification).toBe('VERIFIED');
    expect(result.requirementSupported).toBe(true);
    expect(result.evidenceSupported).toBe(true);
  });

  it('does not treat a start URL as proof that a control exists', () => {
    const result = classifyScenario(
      scenario({
        title: 'Filter inventory by color',
        description: 'The user should filter inventory by color',
        steps: [{ order: 1, action: 'Open a color filter that was not observed' }],
        evidenceRefs: ['https://shop.example.com'],
        assumptions: [],
        expectedResult: 'Color filter is applied',
      }),
      requirement,
      exploration
    );
    expect(result.evidenceSupported).toBe(false);
    expect(result.classification).not.toBe('VERIFIED');
    expect(result.reasons.some((reason) => /url/i.test(reason))).toBe(true);
  });

  it('rejects unsupported payment hallucinations', () => {
    const result = classifyScenario(
      scenario({
        scenarioKey: 'GH-002-SC01',
        title: 'Enter credit-card details and select a payment method',
        description: 'Apply a discount code and verify an email receipt',
        steps: [{ order: 1, action: 'Enter credit card number' }],
        expectedResult: 'Payment is processed',
        requirementRefs: [],
        evidenceRefs: [],
        assumptions: [],
        rationale: 'Invented',
      }),
      { title: 'Hallucination challenge', description: 'Do not invent checkout payment fields', acceptanceCriteria: '' },
      exploration
    );
    expect(result.classification).toBe('UNSUPPORTED');
  });

  it('marks requirement-only scenarios as NEEDS_REVIEW when UI evidence is missing', () => {
    const result = classifyScenario(
      scenario({
        title: 'Complete the order',
        description: 'The user should complete the order',
        evidenceRefs: [],
        steps: [{ order: 1, action: 'Finish checkout that was not observed' }],
        assumptions: ['The completion flow exists'],
      }),
      requirement,
      exploration
    );
    expect(result.classification).toBe('NEEDS_REVIEW');
    expect(result.evidenceSupported).toBe(false);
  });
});
