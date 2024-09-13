[![NPM License](https://img.shields.io/npm/l/%40nxextensions%2Ffirebase)]()
[![NPM Version](https://img.shields.io/npm/v/%40nxextensions%2Ffirebase)]()

# Nx Firebase

A plugin for Nx that auto-detects Firebase in your project and starts the emulators with your app, or deploys
your application when ready.

## Installation

`npm i @nxextensions/firebase --save-dev`

or run:

`nx add @nxextensions/firebase`

to automatically configure and install the plugin.

## Configuration

In `nx.json` add:

```json
{
  "plugins": [
    {
      "plugin": "@nxextensions/firebase",
      "options": {
        "serveTargetName": "serve-firebase"
      }
    }
  ]
}
```
