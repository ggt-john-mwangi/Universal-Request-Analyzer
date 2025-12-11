# Contributing to Universal Request Analyzer

Thank you for your interest in contributing to Universal Request Analyzer! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read it before contributing.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers understand your report, reproduce the behavior, and find related reports.

- Use a clear and descriptive title
- Describe the exact steps to reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed after following the steps
- Explain which behavior you expected to see instead and why
- Include screenshots if possible
- Include details about your browser and operating system

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality.

- Use a clear and descriptive title
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the steps
- Describe the current behavior and explain which behavior you expected to see instead
- Explain why this enhancement would be useful to most users

### JavaScript Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Naming**:
  - Classes: PascalCase
  - Functions/Variables: camelCase
  - Constants: UPPER_SNAKE_CASE
- **Comments**: Use JSDoc for functions and classes

See [Development Guide - Code Style](docs/DEVELOPMENT.md#code-style--standards) for complete guidelines.

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Include screenshots and animated GIFs for UI changes
- Follow the JavaScript styleguide
- Include tests when adding new features
- Update documentation if needed
- End all files with a newline
- Avoid platform-dependent code

**Before Submitting:**
- [ ] Run `npm run lint` - No linting errors
- [ ] Run `npm test` - All tests pass
- [ ] Run `npm run build` - Builds successfully
- [ ] Test in browser - Extension works as expected
- [ ] Update documentation - If adding/changing features

## Development Setup

For detailed development instructions, see [Development Guide](docs/DEVELOPMENT.md).

**Quick Start:**
```bash
git clone https://github.com/YOUR_USERNAME/Universal-Request-Analyzer.git
cd Universal-Request-Analyzer
npm install
npm run build
```

## Documentation

Help improve our documentation:

- **User Guide**: [docs/USER_GUIDE.md](docs/USER_GUIDE.md) - User-facing documentation
- **Development Guide**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Developer documentation
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical architecture
- **Adoption Analysis**: [docs/ADOPTION_ANALYSIS.md](docs/ADOPTION_ANALYSIS.md) - Market analysis

When contributing, ensure documentation stays up-to-date with code changes.

## Styleguides

### Git Commit Messages

Follow conventional commits format:

```
type(scope): subject

body (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tool changes

**Examples:**
```
feat(popup): add request type filter
fix(database): resolve SCD Type 2 version conflict
docs(user-guide): update performance metrics section
```

### Code Style

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests in the body

### JavaScript Styleguide

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Prefer const over let and let over var
- Use template literals instead of string concatenation
- Use destructuring assignment when possible
- Use arrow functions for callbacks
- Use async/await instead of promises when possible

### CSS Styleguide

- Use 2 spaces for indentation
- Use dashes instead of camelCasing in class names
- Use one discrete selector per line in multi-selector rulesets
- Include one space before the opening brace of declaration blocks
- Place closing braces of declaration blocks on a new line
- Include one space after the colon of a declaration
- Use lowercase and shorthand hex values, e.g., "#fff" instead of "#FFFFFF"
- Use single or double quotes consistently, e.g., `content: ''`
- Quote attribute values in selectors, e.g., `input[type="checkbox"]`
- Avoid specifying units for zero values, e.g., `margin: 0`

## Development Environment

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/universal-request-analyzer.git`
3. Navigate to the project directory: `cd universal-request-analyzer`
4. Install dependencies: `npm install`
5. Build the extension: `npm run build`
6. Load the `build` directory as an unpacked extension in your browser

### Development Workflow

1. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run tests: `npm test`
4. Build the extension: `npm run build`
5. Test your changes in the browser
6. Commit your changes: `git commit -m "Add your feature name"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a Pull Request from your fork to the main repository

## Additional Notes

### Issue and Pull Request Labels

This section lists the labels we use to help us track and manage issues and pull requests.

- `bug`: Issues that are bugs
- `enhancement`: Issues that are feature requests
- `documentation`: Issues or pull requests that relate to documentation
- `good first issue`: Issues that are good for newcomers
- `help wanted`: Issues that need assistance
- `question`: Issues that are questions
- `wontfix`: Issues that will not be worked on
