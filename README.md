# Duck Hunt JS IA Fork

[Play on GitHub Pages](https://mur1ll0.github.io/DuckHunt-JS-IA/)

This repository is a fork of the original Duck Hunt JS project:
[MattSurabian/DuckHunt-JS](https://github.com/MattSurabian/DuckHunt-JS)

It keeps the original JavaScript and HTML5 game foundation (PixiJS rendering, GSAP animation, and Howler audio), and extends gameplay with AI-focused modes.

## What Is Different In This Fork

- Automatic aiming mode (assisted crosshair behavior).
- AI-guided aiming mode powered by TensorFlow.js.
- Duck behavior experimentation with a genetic algorithm.
- Main menu mode selection flow before starting a run.

## Requirements

- Node.js 20.x
- npm (bundled with Node.js)

## Run Locally

1. Clone the repository.
2. Install dependencies:

	 npm ci

3. Start the development server:

	 npm start

4. Open the game at http://localhost:8080/

## Build And Validation Commands

- Production build:

	npm run build

- Lint source files:

	npm run lint

## Optional Asset Pipelines

- Rebuild audio sprites:

	npm run audio

	Requires ffmpeg: https://ffmpeg.org/download.html

- Rebuild image sprites:

	npm run images

	Requires TexturePacker: https://www.codeandweb.com/texturepacker/download

## Deployment

GitHub Pages deployment is automated through GitHub Actions. Every push to main or master triggers a build and publishes the dist folder.

## Bugs

Please report bugs in this fork repository issues.
