# Publishing (VSCode Marketplace)

This extension is ready for Marketplace publishing, but you must set a real publisher id first.

## 1) Set publisher id

Edit `extensions/vscode/package.json`:

- Ensure `"publisher"` is set to your Marketplace publisher id (this repo uses `weapp-vite`).

## 2) Create a publisher + PAT

- Create a publisher at https://marketplace.visualstudio.com/
- Create an Azure DevOps Personal Access Token (PAT) with Marketplace publish permissions.

## 3) Package and publish

From repo root:

```bash
cd extensions/vscode

# package a .vsix for local verification
npx @vscode/vsce package

# login and publish
npx @vscode/vsce login weapp-vite
npx @vscode/vsce publish
```
