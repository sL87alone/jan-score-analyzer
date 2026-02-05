 # Jan Score Analyzer - Static Demo
 
 A client-side JEE Main score analyzer that works on GitHub Pages.
 
 ## Features
 
 - 🎯 Parse JEE Main response sheets (HTML file upload)
 - 📊 Calculate total marks, accuracy, and negative marks
 - 📈 Estimate percentile based on previous trends
 - 🌙 Dark/Light mode support
 - 📱 Fully responsive design
 
 ## Deployment to GitHub Pages
 
 ### Option 1: Manual Deploy
 
 1. Build the project:
    ```bash
    cd static-demo
    npm install
    npm run build
    ```
 
 2. The `dist` folder contains your built files
 
 3. Push the contents of `dist` to a GitHub repository
 
 4. Enable GitHub Pages from repository Settings → Pages → Source: Deploy from branch → Select `main` or `gh-pages`
 
 ### Option 2: GitHub Actions (Recommended)
 
 1. Copy the entire `static-demo` folder to a new GitHub repository
 
 2. Create `.github/workflows/deploy.yml`:
 
 ```yaml
 name: Deploy to GitHub Pages
 
 on:
   push:
     branches: [main]
 
 permissions:
   contents: read
   pages: write
   id-token: write
 
 jobs:
   build:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with:
           node-version: 20
           cache: npm
       - run: npm ci
       - run: npm run build
       - uses: actions/upload-pages-artifact@v3
         with:
           path: dist
 
   deploy:
     needs: build
     runs-on: ubuntu-latest
     environment:
       name: github-pages
       url: ${{ steps.deployment.outputs.page_url }}
     steps:
       - uses: actions/deploy-pages@v4
         id: deployment
 ```
 
 3. Go to repository Settings → Pages → Source: GitHub Actions
 
 4. Push to main branch - it will auto-deploy!
 
 ## URL Structure
 
 The app will be available at:
 ```
 https://<username>.github.io/jan-score-analyzer/
 ```
 
 ## Changing Base Path
 
 If your repository name is different, update `vite.config.ts`:
 
 ```ts
 export default defineConfig({
   base: "/your-repo-name/",
   // ...
 });
 ```
 
 Also update `404.html` with the matching base path.
 
 ## Technology Stack
 
 - React 18
 - TypeScript
 - Vite
 - Tailwind CSS
 - Lucide Icons
 
 ## Limitations
 
 This is a static demo version:
 - URL fetching is disabled (requires backend/CORS proxy)
 - Data is not persisted between sessions
 - Percentile estimation is approximate
 
 For the full-featured version with backend support, use the main ScoreX application.