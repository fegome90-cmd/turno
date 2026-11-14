import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

// Direct React.act calls also need the test environment flag when Vitest globals are off.
Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

afterEach(() => {
  cleanup();
});
