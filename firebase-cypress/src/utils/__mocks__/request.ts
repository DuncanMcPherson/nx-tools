let emulatorRequestCount = 0;
let serverRequestCount = 0;

export default function request(url: string, success: () => void, failure: () => void) {
  return new Promise<void>((resolve) => {
    if (url.endsWith('9099')) {
      if (emulatorRequestCount++ === 0) {
        failure();
        resolve();
        return;
      }
      success();
      resolve();
      return;
    }

    if (serverRequestCount++ === 0) {
      failure();
      resolve();
      return;
    }

    success();
    resolve();
  })
}
