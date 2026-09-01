import { constrainScenarioToEvidence, isControlEvidenceRef, matchElements } from './matching';

const exploration = {
  startUrl: 'https://shop.example.com',
  pages: [
    {
      url: 'https://shop.example.com/inventory',
      title: 'Products',
      snapshot: 'Add to cart',
      headings: ['Products'],
      interactiveElements: [
        { tag: 'button', text: 'Add to cart', testId: 'add-to-cart-widget', selector: '[data-testid="add-to-cart-widget"]' },
      ],
    },
  ],
  observations: [],
  consoleMessages: [],
  networkErrors: [],
};

describe('evidence matching', () => {
  it('matches observed controls by distinctive tokens rather than a start URL', () => {
    const matches = matchElements('Add widget to the cart', exploration.pages[0].interactiveElements);
    expect(matches[0]?.testId).toBe('add-to-cart-widget');
    expect(isControlEvidenceRef('testid:add-to-cart-widget', exploration)).toBe(true);
    expect(isControlEvidenceRef('https://shop.example.com', exploration)).toBe(false);
  });

  it('drops invented locators from a planned scenario', () => {
    const grounded = constrainScenarioToEvidence(
      {
        scenarioKey: 'SC-1',
        title: 'Use a fake discount field',
        description: 'Type a promo code',
        steps: [
          { order: 1, action: 'Fill promo', target: 'testid:promo-code' },
          { order: 2, action: 'Add item', target: 'testid:add-to-cart-widget' },
        ],
        expectedResult: 'Discount applied',
        requirementRefs: ['REQ'],
        evidenceRefs: ['https://shop.example.com', 'testid:promo-code', 'testid:add-to-cart-widget'],
        assumptions: [],
        rationale: 'test',
      },
      exploration
    );
    expect(grounded.evidenceRefs).toEqual(['testid:add-to-cart-widget']);
    expect(grounded.steps[0].target).toBeUndefined();
    expect(grounded.steps[1].target).toBe('testid:add-to-cart-widget');
  });
});
