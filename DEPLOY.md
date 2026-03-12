# Deploy Guide

## One-time setup
Run once per machine:

```bash
npx vercel login
npx vercel link
```

## Daily workflow
From project root:

```bash
npm run dev
```

When ready to publish changes:

```bash
git add -A
git commit -m "your message"
git push origin main
```

## Deploy commands
- Preview deploy:

```bash
npm run deploy:preview
```

- Normal production deploy:

```bash
npm run deploy:prod
```

- Force rebuild production (skip cache, use this if live looks stale or unstyled):

```bash
npm run deploy:prod:force
```

## Verify live bundle
Check which assets the domain is serving:

```bash
curl -s https://www.violetsandvibes.com | grep -oE 'assets/index-[^" ]+\.(js|css)' | sort -u
```

Check CSS size:

```bash
curl -sI https://www.violetsandvibes.com/assets/<css-file-from-above>
```

If CSS is unexpectedly tiny and page looks like plain HTML, run:

```bash
npm run deploy:prod:force
```
