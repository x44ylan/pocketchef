// Integration adapter; the upstream worker remains unmodified.
importScripts("./ChefWorker.js");

// Jimp's bitmap-font loader joins absolute URLs as filesystem paths, producing
// /host/engine/assets/fonts/page.png. Repair only this same-origin font path.
// The absolute docURL remains necessary for Tesseract's nested blob worker.
const upstreamFetch = self.fetch.bind(self);
self.fetch = (input, init) => {
  const original =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const url = new URL(original, self.location.href);
  const prefix = `/${self.location.host}/engine/assets/fonts/`;
  if (url.origin === self.location.origin && url.pathname.startsWith(prefix)) {
    url.pathname = url.pathname.slice(self.location.host.length + 1);
    input = input instanceof Request ? new Request(url, input) : url.href;
  }
  return upstreamFetch(input, init);
};
self.postMessage({ action: "catalog", data: self.OperationConfig });
