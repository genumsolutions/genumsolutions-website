import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier/flat";

// Next 16 removed `next lint`, so ESLint runs directly. The flat config keeps
// the same rule set the old .eslintrc.json extended (core-web-vitals) with
// prettier last so formatting rules never fight.
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
      "dist/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  eslintConfigPrettier,
  {
    rules: {
      "@next/next/no-img-element": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["error", "warn"] }],
      // eslint-config-next 16 turns on the React Compiler rules. Adopting them
      // is a real refactor (25 effects hydrate state from storage/URL), not a
      // framework upgrade, so they stay off until that work is scheduled.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/globals": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];
