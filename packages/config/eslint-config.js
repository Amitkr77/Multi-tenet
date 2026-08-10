// Shared base ESLint (flat config) rules. Apps spread this into their own eslint.config.mjs:
//   import base from '@saas/config/eslint-config';
//   export default [...base, { /* app-specific overrides */ }];
module.exports = [
  {
    rules: {
      "no-unused-vars": "off", // handled by @typescript-eslint in each app's own config
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
    },
  },
];
