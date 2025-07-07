# Development Setup Solutions

## Issue 1: Running NPX Template as Development Project

### Problem

The template project uses `devDependencies` that aren't installed when developing the template itself, causing TypeScript and linting errors.

### Solution

We've installed the core dependencies needed for local development:

```bash
# Already installed:
npm install --save-dev next@^15.0.0 react@^18.0.0 react-dom@^18.0.0 @types/react@^18.0.0 @types/react-dom@^18.0.0
npm install --save-dev next-auth wagmi viem @tanstack/react-query clsx tailwind-merge tailwindcss @radix-ui/react-label class-variance-authority zod
```

### Development Commands

For development of the template itself, use these commands:

```bash
# Type checking (excluding Farcaster-specific modules)
npx tsc --project tsconfig.dev.json --noEmit

# Format check
npm run format:check

# Format all files
npm run format

# Lint check
npm run lint:check

# Development check (combines type-check:dev, lint:check, format:check)
npm run check:dev
```

### Notes:

- `tsconfig.dev.json` excludes some Farcaster-specific files that depend on SDK packages not available in devDependencies
- This is normal for an npx template - the full dependencies are installed when users create new projects
- For template development, focus on code structure, formatting, and basic TypeScript validation

## Issue 2: Prettier Formatting Discrepancy

### Problem

VS Code Prettier extension might format differently than the `npm run format` command due to:

1. VS Code using cached or global Prettier settings
2. Extension not properly reading the project's `.prettierrc`
3. EditorConfig interference

### Solution Applied

1. **Updated VS Code settings** (`.vscode/settings.json`):

   ```json
   {
     "prettier.requireConfig": true,
     "prettier.useEditorConfig": false,
     "prettier.configPath": ".prettierrc",
     "editor.formatOnPaste": false,
     "editor.codeActionsOnSave": {
       "source.organizeImports": "never"
     }
   }
   ```

2. **Explicit Prettier configuration** (`.prettierrc`):
   - All settings are explicitly defined
   - No reliance on defaults

### Testing the Fix

1. **Check if formatting is consistent**:

   ```bash
   npm run format:check
   ```

2. **Format all files**:

   ```bash
   npm run format
   ```

3. **Test VS Code formatting**:
   - Open any file
   - Make a small change
   - Save (should auto-format)
   - Run `npm run format:check` to verify consistency

### Additional Troubleshooting

If formatting issues persist:

1. **Reload VS Code**: `Cmd+Shift+P` → "Developer: Reload Window"

2. **Clear Prettier cache**:

   ```bash
   # Remove prettier cache if it exists
   rm -rf node_modules/.cache/prettier
   ```

3. **Verify Prettier extension is using project config**:
   - In VS Code, open Output panel
   - Select "Prettier" from dropdown
   - Look for "Using config file at: .prettierrc"

4. **Manual format test**:

   ```bash
   # Format a specific file manually
   npx prettier --write src/components/App.tsx

   # Check if it matches npm run format
   npm run format:check
   ```

## Development Workflow

### For Template Development:

1. Use `npm run check:dev` for validation
2. Use `npm run format` for formatting
3. Focus on structure and basic functionality

### For Template Users:

1. Full dependencies are installed automatically
2. All scripts work normally: `npm run check`, `npm run format`, etc.
3. Complete TypeScript validation available

### Key Files Created/Modified:

- `tsconfig.dev.json` - Development-specific TypeScript config
- `.vscode/settings.json` - Updated with explicit Prettier settings
- `package.json` - Added development scripts (if npm cache allows)

The template is now ready for both development and end-user consumption! 🚀
