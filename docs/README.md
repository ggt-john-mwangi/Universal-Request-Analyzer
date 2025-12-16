# GitHub Pages for Universal Request Analyzer

This directory contains the GitHub Pages site for Universal Request Analyzer.

## Local Development

To test the site locally:

```bash
# Install dependencies
gem install bundler jekyll
bundle install

# Run the local server
bundle exec jekyll serve

# Open http://localhost:4000/Universal-Request-Analyzer/
```

## Deployment

GitHub Pages automatically deploys this site when you push to the main branch.

The site will be available at: https://ModernaCyber.github.io/Universal-Request-Analyzer/

## Structure

- `_config.yml` - Jekyll configuration
- `index.md` - Homepage content
- `Gemfile` - Ruby dependencies
- `.nojekyll` - Tells GitHub Pages to process the site with Jekyll

## Customization

### Change Theme

Edit `_config.yml` and change the `theme` line:

```yaml
theme: jekyll-theme-slate # or minimal, midnight, architect, etc.
```

### Custom Domain

If you have a custom domain:

1. Add it to the `CNAME` file
2. Configure DNS with your domain provider
3. Enable custom domain in repository Settings → Pages

### Add Google Analytics

Edit `_config.yml` and uncomment:

```yaml
google_analytics: UA-XXXXXXXXX-X
```
