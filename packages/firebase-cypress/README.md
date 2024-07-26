[![NPM License](https://img.shields.io/npm/l/%40nxextensions%2Ffirebase-cypress)]()
[![NPM Version](https://img.shields.io/npm/v/%40nxextensions%2Ffirebase-cypress)]()

# Firebase Cypress

A plugin for Nx that auto-detects Firebase in your project and starts the emulators if they are configured.

## Installation

`npm i @nxextensions/firebase-cypress --save-dev`

## Configuration

In `nx.json` add:

```json
{
  ...
  "plugins": [
    {
      "plugin": "@nxextensions/firebase-cypress",
      "options": {
        "targetName": "e2e",
        "openTargetName": "open-cypress",
        "componentTestingTargetName": "component-test",
        "ciTargetName": "e2e-ci"
      }
    }
  ]
}
```
