# How to publish ebbtech.co

The live site is the Cloudflare Pages project **ebbtech** (Direct Upload, no Git connection).
Everything that goes live is in the `site/` folder. Nothing else in this folder is uploaded.

## 1. Edit
Change files in `site/` (`index.html`, `support.html`, `privacy.html`, `styles.css`, `assets/images/`).
Keep images small: about 720 px wide, JPEG. Example:

    sips -s format jpeg -s formatOptions 82 --resampleWidth 720 input.png --out site/assets/images/name.jpg

## 2. Check locally
    python3 -m http.server 8787 --bind 127.0.0.1 --directory site
Open http://127.0.0.1:8787 in a browser. For phone and desktop screenshots of every page:

    node tools/shoot.mjs http://127.0.0.1:8787 screenshots/after

## 3. Save to GitHub
    git add -A
    git -c user.name=ebbs7one -c user.email=ebbs7one@gmail.com commit -m "Describe the change"
    git push

## 4. Deploy
    npx wrangler login                      # first time only; approve in the browser
    npx wrangler pages project list         # shows the ebbtech project's production branch
    npx wrangler pages deploy site --project-name ebbtech --branch main

The production branch is `main` (checked November 23, 2026). If in doubt, run
`npx wrangler pages deployment list --project-name ebbtech --environment production` and use the Branch shown.
A different `--branch` makes a preview deploy, not a live one.

Never create a new Pages project, and never change domains or DNS.

## 5. Confirm
Open https://www.ebbtech.co/, /support.html and /privacy.html (hard refresh) and check the changes are there.
Cloudflare redirects /support.html to /support and /privacy.html to /privacy; that is normal, and both addresses work.
