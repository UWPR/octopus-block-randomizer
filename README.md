# Octopus Block Randomizer

A web application for optimizing the distribution of experimental samples across multiple plates with balanced randomization and support for repeated-measures variables.

## Features

- **Balanced Distribution**: Ensures each plate contains a representative mix of sample types based on selected covariates
- **Repeated-measures Support**: Groups samples from the same subject that must stay together on the same plate
- **Spatial Randomization**: Minimizes clustering of similar samples to reduce position-based biases
- **Quality Assessment**: Built-in metrics to evaluate balance and randomization quality
- **Multiple Algorithms**: Choose from Balanced Spatial, Balanced Block, or Greedy randomization
- **Interactive Visualization**: Compact and full-size views with quality metrics and covariate highlighting

## Documentation

- [User Guide](docs/octopus_doc.md) - Complete guide to using the application
- [Repeated-measures Variables](docs/octopus_doc.md#working-with-repeated-measures-variables) - Guide to grouping related samples
- [Quality Scoring](docs/quality-scoring-documentation.md) - Details on quality metrics
- [Algorithm Documentation](docs/balanced-randomization-algorithm.md) - Technical details on randomization algorithms

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

**For CI/automated testing (non-interactive):**
```bash
npm test -- --watchAll=false
```

This runs all tests once and exits, which is useful for continuous integration or when you want to verify all tests pass without entering watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
