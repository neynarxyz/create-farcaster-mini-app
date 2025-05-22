# Farcaster Mini Apps (formerly Frames) Quickstart by Neynar 🪐

A Farcaster Mini Apps quickstart npx script.

This is a [NextJS](https://nextjs.org/) + TypeScript + React app.

## Guide

Check out [this Neynar docs page](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s) for a simple guide on how to create a Farcaster Mini App in less than 60 seconds!

## Getting Started

To create a new mini-app project, run:
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
