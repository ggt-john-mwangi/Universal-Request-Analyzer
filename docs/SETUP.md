# GitHub Pages Setup Guide

## Quick Setup (Recommended)

Follow these steps to enable your GitHub Pages site:

### Step 1: Push to GitHub

Make sure your `docs` folder is committed and pushed to your repository:

```bash
git add docs/
git commit -m "Add GitHub Pages site"
git push origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/ModernaCyber/Universal-Request-Analyzer`
2. Click **Settings** (top navigation)
3. Scroll down and click **Pages** (left sidebar)
4. Under **Source**:
   - Branch: Select `main`
   - Folder: Select `/docs`
5. Click **Save**

### Step 3: Wait for Deployment

GitHub will build your site automatically. After 1-2 minutes, your site will be live at:

**https://ModernaCyber.github.io/Universal-Request-Analyzer/**

You'll see a green checkmark when it's ready! ✅

---

## Verification Steps

### Check Build Status

1. Go to **Actions** tab in your repository
2. You should see "pages build and deployment" workflow
3. Wait for the green checkmark ✅

### Test Your Site

Once deployed, visit:

- **Homepage**: https://ModernaCyber.github.io/Universal-Request-Analyzer/
- **Images**: Should load automatically from `src/assets/images/`

---

## Local Testing (Optional)

Test the site on your computer before pushing:

### Install Jekyll (One-time setup)

**Windows:**

```powershell
# Install Ruby (download from https://rubyinstaller.org/)
# Then install Jekyll
gem install bundler jekyll
```

**Mac/Linux:**

```bash
# Install Ruby (if not installed)
sudo apt-get install ruby-full  # Ubuntu/Debian
# or
brew install ruby  # Mac

# Install Jekyll
gem install bundler jekyll
```

### Run Local Server

```bash
cd docs
bundle install
bundle exec jekyll serve

# Open http://localhost:4000/Universal-Request-Analyzer/
```

Press `Ctrl+C` to stop the server.

---

## Customization Options

### Change Theme

Edit `docs/_config.yml`:

```yaml
theme: jekyll-theme-slate # Dark theme
# Options: cayman, slate, minimal, midnight, architect, tactile, time-machine
```

**Preview themes:** https://pages.github.com/themes/

### Add Custom Domain

If you own a domain (e.g., `ura.yourdomain.com`):

1. **Update CNAME file:**

   ```bash
   echo "ura.yourdomain.com" > docs/CNAME
   ```

2. **Configure DNS** (at your domain provider):

   ```
   Type: CNAME
   Name: ura (or your subdomain)
   Value: ModernaCyber.github.io
   ```

3. **Enable in GitHub:**

   - Go to Settings → Pages
   - Enter your custom domain
   - Check "Enforce HTTPS"

4. **Wait for DNS** (can take up to 48 hours)

### Add Google Analytics

Edit `docs/_config.yml`:

```yaml
google_analytics: UA-XXXXXXXXX-X # Your tracking ID
```

Get tracking ID: https://analytics.google.com/

---

## Troubleshooting

### Images Not Showing

**Problem:** Screenshots show broken image icons

**Solution:** Verify image paths in `docs/index.md`:

```markdown
![Image](../src/assets/images/filename.png)
```

The `..` goes up one level from `docs/` to the root.

### 404 Page Not Found

**Problem:** Site shows 404 error

**Solutions:**

1. **Check GitHub Pages settings:**
   - Settings → Pages → Source should be `main` branch and `/docs` folder
2. **Wait for deployment:**

   - Check Actions tab for build status
   - Can take 1-2 minutes after enabling

3. **Verify URL:**
   - Use: `https://[username].github.io/[repo-name]/`
   - Not: `https://[username].github.io/`

### CSS Not Loading

**Problem:** Site looks plain, no theme styling

**Solution:** Check `docs/_config.yml`:

```yaml
baseurl: "/Universal-Request-Analyzer" # Must match repo name
theme: jekyll-theme-cayman
```

### Local Server Won't Start

**Problem:** `bundle exec jekyll serve` fails

**Solutions:**

1. **Install dependencies:**

   ```bash
   cd docs
   bundle install
   ```

2. **Update bundler:**

   ```bash
   gem install bundler
   bundle update
   ```

3. **Check Ruby version:**
   ```bash
   ruby --version  # Should be 2.5 or higher
   ```

---

## Advanced: Custom Layouts

### Create Custom Layout

1. **Create layout file:**

   ```bash
   mkdir -p docs/_layouts
   ```

2. **Add `docs/_layouts/default.html`:**

   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <title>{{ page.title }} - {{ site.title }}</title>
       <link
         rel="stylesheet"
         href="{{ '/assets/css/style.css' | relative_url }}"
       />
     </head>
     <body>
       <header>
         <h1>{{ site.title }}</h1>
         <p>{{ site.description }}</p>
       </header>
       <main>{{ content }}</main>
       <footer>
         <p>&copy; 2025 {{ site.github_username }}</p>
       </footer>
     </body>
   </html>
   ```

3. **Add custom CSS:**

   ```bash
   mkdir -p docs/assets/css
   ```

4. **Add `docs/assets/css/style.scss`:**

   ```scss
   ---
   ---

   @import "{{ site.theme }}";

   /* Your custom styles */
   header {
     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
     color: white;
     padding: 40px 0;
   }
   ```

---

## Files Overview

```
docs/
├── _config.yml          # Jekyll configuration
├── index.md             # Homepage content
├── Gemfile              # Ruby dependencies
├── .nojekyll            # Tells GitHub to use Jekyll
├── CNAME                # Custom domain (optional)
├── README.md            # Documentation
├── _layouts/            # Custom layouts (optional)
│   └── default.html
└── assets/              # Custom assets (optional)
    └── css/
        └── style.scss
```

---

## Resources

- **Jekyll Documentation:** https://jekyllrb.com/docs/
- **GitHub Pages Guide:** https://docs.github.com/en/pages
- **Jekyll Themes:** https://pages.github.com/themes/
- **Markdown Guide:** https://www.markdownguide.org/

---

## Next Steps

After your site is live:

1. ✅ **Share the URL** in your README.md
2. ✅ **Add to repository description** (About section)
3. ✅ **Tweet/share** your extension site
4. ✅ **Add screenshots** to browser store listings
5. ✅ **Monitor traffic** with Google Analytics (optional)

---

**Questions?** Open an issue on GitHub or check the [Jekyll documentation](https://jekyllrb.com/docs/).
