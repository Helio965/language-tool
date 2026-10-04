import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// O jsdom não implementa rolagem; os componentes a usam só para conforto visual.
Element.prototype.scrollTo ??= function scrollTo() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
