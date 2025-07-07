# Formatting and Code Style Guide

This project uses a comprehensive set of tools to ensure consistent code formatting and quality across the entire codebase.

## Tools Configured

### 🎨 **Prettier** - Code Formatter

- Automatically formats JavaScript, TypeScript, CSS, JSON, and Markdown files
- Configuration: `.prettierrc`
- Ignore patterns: `.prettierignore`

### 🔍 **ESLint** - Linter and Code Quality

- Enforces code quality rules and catches potential bugs
- Configuration: `.eslintrc.json`
- Ignore patterns: `.eslintignore`

### ⚙️ **EditorConfig** - Cross-Editor Consistency

- Ensures consistent indentation and line endings across different editors
- Configuration: `.editorconfig`

### 🔧 **VS Code Settings**

- Pre-configured workspace settings for optimal development experience
- Configuration: `.vscode/settings.json`
- Recommended extensions: `.vscode/extensions.json`

## Quick Start

### Installation

When you create a new project using this template, all formatting tools are already configured. Simply run:

```bash
npm install
```

### Available Scripts

#### Formatting

```bash
npm run format          # Format all files with Prettier
npm run format:check    # Check if files are properly formatted
npm run format:fix      # Format files and fix ESLint issues
```

#### Linting

```bash
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint and auto-fix issues
npm run lint:check     # Run ESLint with zero warnings tolerance
```

#### Type Checking

```bash
npm run type-check     # Run TypeScript compiler without emitting files
```

#### Combined Checks

```bash
npm run check          # Run type-check, lint:check, and format:check
```

## Editor Setup

### VS Code (Recommended)

1. Install recommended extensions when prompted
2. Formatting and linting will work automatically on save
3. Key extensions:
   - **Prettier**: Code formatter
   - **ESLint**: Linting and error detection
   - **EditorConfig**: Consistent editor settings

### Other Editors

- **WebStorm/IntelliJ**: Built-in support for Prettier and ESLint
- **Vim/Neovim**: Use appropriate plugins for Prettier and ESLint
- **Emacs**: Configure with prettier-js and flycheck-eslint

## Configuration Details

### Prettier Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### Key ESLint Rules

- TypeScript and React best practices
- Prettier integration (no conflicts)
- Async/await safety rules
- Import organization
- Console warnings (allows warn/error)

### EditorConfig Settings

- 2-space indentation for most files
- LF line endings
- UTF-8 encoding
- Trim trailing whitespace
- Insert final newline

## Git Hooks (Optional)

You can set up pre-commit hooks using `husky` and `lint-staged`:

```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

The project includes a `.lintstagedrc` configuration that will:

- Run ESLint and Prettier on staged JS/TS files
- Run Prettier on staged JSON, CSS, and Markdown files

## Team Guidelines

### Before Committing

1. Run `npm run check` to ensure code quality
2. Fix any linting errors or formatting issues
3. Commit your changes

### Pull Request Requirements

- All checks must pass
- Code must be properly formatted
- No ESLint warnings or errors
- TypeScript compilation must succeed

### Customization

If you need to modify the formatting rules:

1. **Prettier**: Edit `.prettierrc`
2. **ESLint**: Edit `.eslintrc.json`
3. **EditorConfig**: Edit `.editorconfig`

Remember to discuss any changes with your team first!

## Troubleshooting

### Common Issues

#### "Prettier and ESLint conflict"

- This shouldn't happen as we use `eslint-config-prettier`
- If it does, check that Prettier rules come last in ESLint extends

#### "Format on save not working"

- Ensure Prettier extension is installed and enabled
- Check VS Code settings for `editor.formatOnSave: true`
- Verify the file type is in ESLint validation array

#### "TypeScript errors in JavaScript files"

- Check file extension (.js vs .ts)
- Verify ESLint overrides for JavaScript files

#### "Formatting different in CI vs local"

- Ensure same Node.js version
- Check line ending settings (LF vs CRLF)
- Verify Prettier version consistency

### Getting Help

- Check the documentation for [Prettier](https://prettier.io/)
- Check the documentation for [ESLint](https://eslint.org/)
- Review [Next.js ESLint configuration](https://nextjs.org/docs/basic-features/eslint)

## Best Practices

### File Organization

- Keep configuration files in project root
- Use meaningful names for custom ESLint rules
- Group related imports together

### Code Style

- Use meaningful variable names
- Prefer `const` over `let` when possible
- Use template literals for string interpolation
- Keep functions small and focused
- Add JSDoc comments for complex functions

### React Specific

- Use functional components with hooks
- Prefer explicit prop types (TypeScript interfaces)
- Use meaningful component names
- Keep components focused on single responsibility

### TypeScript

- Enable strict mode
- Use proper types instead of `any`
- Leverage type inference where appropriate
- Use proper generic constraints

---

_This formatting guide is automatically included with every new project created from this template._
