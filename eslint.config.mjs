import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["build/**", "**/*.d.ts"] },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        languageOptions: { globals: globals.node },
        rules: {
            "no-console": ["warn", { allow: ["debug", "warn", "error", "info"] }],
            "no-debugger": "warn",
            "no-unused-expressions": "off",
            "@typescript-eslint/no-unused-expressions": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-this-alias": "off",
        },
    }
);
