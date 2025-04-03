# Farcaster mini apps (formerly frames) Quickstart by Neynar 🪐

A Farcaster Frames v2 quickstart npx script.

This is a [NextJS](https://nextjs.org/) + TypeScript + React app.

## Getting Started

To create a new frames project, run:
```{bash}
npx @neynar/create-farcaster-mini-app@latest
```

To run the project:
```{bash}
cd <PROJECT_NAME>
npm run dev
```

### Importing the CLI
To invoke the CLI directly in JavaScript, add the npm package to your project and use the following import statement:
```{javascript}
import { init } from '@neynar/create-farcaster-mini-app';
```

## Deploying to Vercel
For projects that have made minimal changes to the quickstart template, deploy to vercel by running:
```{bash}
npm run deploy:vercel
```

## Building for Production

To create a production build, run:
```{bash}
npm run build
```

The above command will generate a `.env` file based on the `.env.local` file and user input. Be sure to configure those environment variables on your hosting platform.
