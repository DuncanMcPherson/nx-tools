// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  interface Chainable<Subject> {
    assert(condition: boolean): Chainable<boolean>;
  }
}

Cypress.Commands.add("assert", (condition) => {
  return cy.wrap(condition === true);
})
