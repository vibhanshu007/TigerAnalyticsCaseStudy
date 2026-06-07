/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Mock the native documents picker module
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(() => Promise.resolve([{ name: 'mock.csv', uri: 'content://mock', size: 1000 }])),
  keepLocalCopy: jest.fn(() => Promise.resolve([{ status: 'success', localUri: 'file:///mock/path.csv' }])),
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
