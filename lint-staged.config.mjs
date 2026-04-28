export default {
  'backend/src/**/*.ts': ['oxlint --fix', 'oxfmt'],
  'frontend/src/**/*.{ts,tsx}': ['oxlint --fix', 'oxfmt'],
};
