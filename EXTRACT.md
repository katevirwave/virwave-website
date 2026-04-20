# Extracting the scaffold into virwave-events-app

This branch is a **transit shunt**. The Next.js events-app scaffold was
built in a sandboxed environment that can only push to this repo, not
to a new one. These are its files, parked here so you can pull them to
your Mac in one step.

## On your Mac

```bash
mkdir -p ~/Developer/virwave
cd ~/Developer/virwave

# Clone this orphan branch directly as a fresh repo
git clone --branch transit/events-app-scaffold --single-branch \
  https://github.com/katevirwave/virwave-website.git virwave-events-app

cd virwave-events-app

# Rename branch and swap remote to the real events-app repo
git branch -m main
git remote set-url origin https://github.com/katevirwave/virwave-events-app.git

# Push up
git push -u origin main
```

After that, Vercel should be pointed at `katevirwave/virwave-events-app`
(not `katevirwave/virwave-website`).

## Cleanup

Once the scaffold is safely in `virwave-events-app` on GitHub, this
branch can be deleted:

```bash
# From your Mac, in virwave-website
git push origin --delete transit/events-app-scaffold
```

Or via GitHub UI → Branches → delete.
