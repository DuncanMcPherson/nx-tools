let cypressPackageJson;
let loadedCypress = false;

export function installedCypressVersion() {
  if (!loadedCypress) {
    try {
      cypressPackageJson = require('cypress/package.json');
      loadedCypress = true;
    } catch {
      // intentionally empty
    }

    if (!cypressPackageJson) {
      return null;
    }

    const cypressPackageVersion = cypressPackageJson.version;
    const majorVersion = cypressPackageVersion.split('.')[0];
    if (!majorVersion) {
      return 0;
    }
    return +majorVersion;
  }
}
