# 🚀 Quick Deploy Checklist

Use this checklist to deploy your GitHub Pages site in under 5 minutes!

## ☑️ Pre-Deployment Checklist

- [ ] All files in `docs/` folder are committed
- [ ] Screenshots in `src/assets/images/` are committed
- [ ] Repository is pushed to GitHub

## 📋 Deployment Steps

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Add GitHub Pages site"
git push origin main
```

### Step 2: Enable GitHub Pages

1. Go to: `https://github.com/ModernaCyber/Universal-Request-Analyzer/settings/pages`
2. Under **Source**:
   - Branch: `main` ✓
   - Folder: `/docs` ✓
3. Click **Save** 💾

### Step 3: Wait for Deployment

- Check **Actions** tab for green checkmark ✅
- Usually takes 1-2 minutes
- Refresh until you see "pages build and deployment" succeeded

### Step 4: Verify

- Visit: https://ModernaCyber.github.io/Universal-Request-Analyzer/
- All screenshots should load correctly
- Navigation should work smoothly

## ✅ Post-Deployment

- [ ] Site is live and accessible
- [ ] All images are loading
- [ ] Links work correctly
- [ ] Theme looks good
- [ ] Mobile responsive works

## 🎨 Optional Customizations

### Change Theme (Easy)

Edit `docs/_config.yml`:

```yaml
theme: jekyll-theme-slate # or minimal, midnight, architect
```

### Add Custom Domain (If you own one)

1. Add domain to `docs/CNAME`: `echo "yourdomain.com" > docs/CNAME`
2. Configure DNS CNAME: `ModernaCyber.github.io`
3. Enable in Settings → Pages → Custom domain
4. Check "Enforce HTTPS"

### Add Google Analytics

Edit `docs/_config.yml`:

```yaml
google_analytics: UA-XXXXXXXXX-X
```

## 🆘 Troubleshooting

### Images Not Showing

- Check path: `../src/assets/images/filename.png`
- Verify files are committed: `git status`
- Wait 2-3 minutes for CDN cache

### 404 Error

- Verify Settings → Pages → Source is set to `main` branch and `/docs`
- Check Actions tab for build errors
- Wait for green checkmark in Actions

### Theme Not Loading

- Check `docs/_config.yml` has correct baseurl
- Clear browser cache
- Try incognito/private window

## 📱 Share Your Site

After deployment, share your site:

```markdown
🌐 Live Site: https://ModernaCyber.github.io/Universal-Request-Analyzer/
```

Add to:

- [ ] Repository description (About section)
- [ ] README.md badges section
- [ ] Social media posts
- [ ] Extension store listing

## 🔗 Useful Links

- **Live Site**: https://ModernaCyber.github.io/Universal-Request-Analyzer/
- **Actions**: https://github.com/ModernaCyber/Universal-Request-Analyzer/actions
- **Settings**: https://github.com/ModernaCyber/Universal-Request-Analyzer/settings/pages
- **Jekyll Docs**: https://jekyllrb.com/docs/

---

**Need Help?** Check [`docs/SETUP.md`](SETUP.md) for detailed instructions.
