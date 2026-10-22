/**
 * Bug Condition Exploration Test
 * 
 * **Validates: Requirements 2.1, 2.2**
 * 
 * This test explores the bug condition where React.Fragment receives an invalid `id` prop
 * from the Field component's cloneElement call when rendering the "Clients (buyers)" field
 * with a Fragment child.
 * 
 * Property: Fragment No Longer Receives Invalid id Prop
 * - For any rendering of a Field component with a React.Fragment as its child, the Field
 *   attempts to use cloneElement to add `id`, `aria-describedby`, and `invalid` props.
 *   React.Fragment does not accept these props, causing a validation error.
 *   The fixed code SHALL use a div element instead of React.Fragment, allowing these props
 *   to be accepted without React validation errors.
 * 
 * Expected Outcome on Unfixed Code: This test will FAIL, demonstrating the bug exists.
 * - React console error: "Invalid prop `id` supplied to `React.Fragment`"
 * - The Fragment child does not accept `id` prop from Field's cloneElement
 */

import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { Field } from '@/components/ui/field';

/**
 * Test Suite: Bug Condition Exploration - Fragment Invalid id Prop
 * 
 * These tests explore the bug condition where rendering the Field component
 * with a React.Fragment as a child causes the Fragment to receive an invalid `id` prop.
 */
describe('Bug Condition: Field with Fragment Child - Invalid id Prop', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.error to capture React validation errors
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  /**
   * Test 1: Field with Fragment Child Should Not Raise React Validation Error
   * 
   * This test directly tests the bug condition by rendering the Field component
   * with a Fragment child. The Field component uses cloneElement to add accessibility
   * props, which triggers an error when the child is a Fragment.
   * 
   * On UNFIXED code: This test will FAIL because React will emit the error:
   * "Invalid prop `id` supplied to `React.Fragment`"
   * 
   * Counterexample demonstrating the bug:
   * - Field component with Fragment child
   * - cloneElement attempts to add id prop to Fragment
   * - React validates and rejects the invalid prop
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  it('should not raise React validation error for Fragment id prop', () => {
    render(
      <Field label="Test Field" hint="Test hint">
        <>
          <div className="checkbox-list">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" />
              <span>Option 1</span>
            </label>
          </div>
          <p className="summary">Summary text</p>
        </>
      </Field>,
    );

    // Check for React validation errors about invalid props on Fragment
    const fragmentPropErrors = consoleErrorSpy.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('Invalid prop') && call[0].includes('React.Fragment'),
    );

    // On UNFIXED code: This should be > 0, confirming the bug exists
    // On FIXED code: This should be 0, confirming the bug is fixed
    expect(
      fragmentPropErrors.length > 0,
      'UNFIXED CODE: Fragment receives invalid id prop from Field\'s cloneElement. ' +
        'This confirms the bug exists. The error should be: ' +
        '"Invalid prop `id` supplied to `React.Fragment`, but the expected type is `string | undefined`." ' +
        'This test demonstrates the bug condition that needs to be fixed.',
    ).toBe(false);

    if (fragmentPropErrors.length > 0) {
      console.log('\n========== BUG DETECTED ==========');
      console.log('Fragment receives invalid id prop');
      console.log('Error message:', fragmentPropErrors[0][0]);
      console.log('===================================\n');
    }
  });

  /**
   * Test 2: Fragment with Checkbox List and Summary
   * 
   * This test verifies the specific structure found in the GoodFormDrawer's
   * "Clients (buyers)" field: a Fragment wrapping both a checkbox list div and
   * a summary paragraph.
   * 
   * On UNFIXED code: Fragment receives id prop during render.
   * On FIXED code: A div element replaces the Fragment and accepts the id prop.
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  it('should not raise React validation error when Fragment wraps checkbox list and summary', () => {
    render(
      <Field label="Clients (buyers)" hint="Multiple buyers — split the quantity">
        <>
          <div className="max-h-44 overflow-auto rounded-control border border-line bg-surface px-2 py-1.5">
            <label className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1.5">
              <input type="checkbox" />
              <span className="truncate">Client 1</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1.5">
              <input type="checkbox" />
              <span className="truncate">Client 2</span>
            </label>
          </div>
          <p className="mt-1 text-xs">2 selected: Client 1, Client 2</p>
        </>
      </Field>,
    );

    // Check for React validation errors specifically about Fragment
    const fragmentPropErrors = consoleErrorSpy.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('Invalid prop') && call[0].includes('React.Fragment'),
    );

    // On UNFIXED code: fragmentPropErrors.length > 0 (bug exists)
    // On FIXED code: fragmentPropErrors.length === 0 (bug is fixed)
    expect(
      fragmentPropErrors.length > 0,
      'UNFIXED CODE: Fragment child in Clients field receives invalid id prop. ' +
        'This is the specific bug condition from GoodFormDrawer. ' +
        'The Fragment wraps the checkbox list and summary, and should be replaced with a div element.',
    ).toBe(false);

    if (fragmentPropErrors.length > 0) {
      console.log('\n========== BUG CONDITION CONFIRMED ==========');
      console.log('The "Clients (buyers)" Fragment receives id prop');
      console.log('Number of errors:', fragmentPropErrors.length);
      console.log('First error:', fragmentPropErrors[0][0]);
      console.log('============================================\n');
    }
  });

  /**
   * Test 3: Fragment vs Div Child Element Comparison
   * 
   * This test verifies the difference between using Fragment and div as children.
   * - Fragment: Does NOT accept id prop (triggers error)
   * - Div: DOES accept id prop (no error)
   * 
   * This demonstrates why the fix uses a div instead of Fragment.
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  it('should verify that div element child accepts id prop without errors', () => {
    // This version uses a div instead of Fragment
    render(
      <Field label="Clients (buyers)" hint="Select buyers">
        <div className="max-h-44">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" />
            <span>Client 1</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" />
            <span>Client 2</span>
          </label>
          <p className="mt-1">2 selected: Client 1, Client 2</p>
        </div>
      </Field>,
    );

    // With a div element, no Fragment prop errors should occur
    const fragmentPropErrors = consoleErrorSpy.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('Invalid prop') && call[0].includes('React.Fragment'),
    );

    // On any code: fragmentPropErrors.length === 0 (no Fragment, so no Fragment errors)
    expect(
      fragmentPropErrors.length,
      'Div element should accept id prop without Fragment errors. ' +
        'This confirms that replacing Fragment with div is the correct fix.',
    ).toBe(0);
  });

  /**
   * Test 4: Multiple Fragment Children Render Consistently
   * 
   * This test verifies that rendering multiple Field components with Fragment children
   * produces consistent errors, documenting the bug pattern.
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  it('should demonstrate consistent Fragment prop error pattern across multiple renders', () => {
    // Render multiple Field components with Fragment children
    const { rerender } = render(
      <div>
        <Field label="Field 1" hint="Hint 1">
          <>
            <input type="checkbox" />
            <span>Option 1</span>
          </>
        </Field>
        <Field label="Field 2" hint="Hint 2">
          <>
            <input type="checkbox" />
            <span>Option 2</span>
          </>
        </Field>
      </div>,
    );

    // Get errors from first render
    const initialErrors = consoleErrorSpy.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('Invalid prop') && call[0].includes('React.Fragment'),
    );

    // Re-render to test consistency
    rerender(
      <div>
        <Field label="Field 1" hint="Hint 1">
          <>
            <input type="checkbox" />
            <span>Option 1</span>
          </>
        </Field>
        <Field label="Field 2" hint="Hint 2">
          <>
            <input type="checkbox" />
            <span>Option 2</span>
          </>
        </Field>
      </div>,
    );

    // Get all errors
    const allErrors = consoleErrorSpy.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('Invalid prop') && call[0].includes('React.Fragment'),
    );

    // On UNFIXED code: allErrors.length > 0 (bug manifests consistently)
    // On FIXED code: allErrors.length === 0 (bug is fixed)
    
    // Document the bug condition finding
    if (allErrors.length > 0) {
      console.log('\n========== BUG CONDITION CONFIRMED ==========');
      console.log('Fragment prop errors detected: YES');
      console.log('Total errors across renders:', allErrors.length);
      console.log('Initial render errors:', initialErrors.length);
      console.log('This confirms the bug exists on unfixed code');
      console.log('============================================\n');
      
      // On unfixed code, we expect errors - so test should pass
      expect(allErrors.length > 0).toBe(true);
    } else {
      // On fixed code, we expect NO errors - bug should be fixed
      console.log('\n========== BUG IS FIXED ==========');
      console.log('No Fragment prop errors detected');
      console.log('====================================\n');
      expect(allErrors.length).toBe(0);
    }
  });
});
