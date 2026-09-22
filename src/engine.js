export class ChefEngine {
  constructor(onProgress = () => {}) {
    this.onProgress = onProgress;
    this.sequence = 0;
    this.start();
  }
  start() {
    this.ready = new Promise((resolve, reject) => {
      this.rejectReady = reject;
      const worker = (this.worker = new Worker("/engine/bridge.js"));
      const timeout = setTimeout(
        () =>
          this.fail(
            new Error(
              "The processing engine could not load. Reload to try again.",
            ),
          ),
        20000,
      );
      this.loadTimeout = timeout;
      worker.onmessage = ({ data: message }) => {
        if (this.worker !== worker) return;
        const { action, data } = message;
        if (action === "catalog") {
          clearTimeout(timeout);
          this.catalog = data;
          this.rejectReady = null;
          resolve(data);
        }
        if (action === "progressMessage")
          this.onProgress(`${data.progress} of ${data.total} steps`);
        if (action === "statusMessage" && data.message)
          this.onProgress(data.message);
        if (action === "dishReturned" && this.conversion?.id === data.id) {
          clearTimeout(this.conversion.timeout);
          this.conversion.resolve(data.value);
          this.conversion = null;
        }
        if (
          (action === "bakeComplete" || action === "bakeError") &&
          this.pending?.id === data.id
        ) {
          const pending = this.pending;
          this.pending = null;
          clearTimeout(pending.timeout);
          if (action === "bakeError" || data.error)
            pending.reject(
              new Error(
                data.error?.displayStr || data.error || "Recipe failed",
              ),
            );
          else pending.resolve(data);
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        this.fail(
          new Error(event.message || "Processing failed. Try baking again."),
        );
      };
      worker.postMessage({
        action: "docURL",
        data: new URL("/engine", location.href).href,
      });
      worker.postMessage({ action: "setLogLevel", data: 4 });
    });
    // Loading can fail before the UI starts a bake.
    this.ready.catch(() => {});
  }
  fail(error) {
    clearTimeout(this.loadTimeout);
    this.worker?.terminate();
    this.rejectReady?.(error);
    this.rejectReady = null;
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(error);
      this.pending = null;
    }
    this.failed = true;
    if (this.conversion) {
      clearTimeout(this.conversion.timeout);
      this.conversion.reject(error);
      this.conversion = null;
    }
  }
  cancel() {
    this.fail(new DOMException("Bake cancelled", "AbortError"));
    this.failed = false;
    this.start();
  }
  async bake(input, recipe) {
    if (this.failed) {
      this.failed = false;
      this.start();
    }
    const worker = this.worker;
    await this.ready;
    if (worker !== this.worker)
      throw new DOMException("Bake cancelled", "AbortError");
    if (this.pending) throw new Error("A recipe is already running");
    for (const step of recipe)
      if (!Object.hasOwn(this.catalog, step.op))
        throw new Error(`Unknown operation: ${step.op}`);
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          this.fail(
            new Error("Bake stopped after 30 seconds. Try a smaller input."),
          ),
        30000,
      );
      this.pending = { id, resolve, reject, timeout };
      worker.postMessage({
        action: "bake",
        data: {
          id,
          input,
          recipeConfig: recipe,
          options: { returnType: "string" },
        },
      });
    });
  }
  async bytes(dish) {
    await this.ready;
    if (this.conversion)
      throw new Error("A download is already being prepared");
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => this.fail(new Error("Could not prepare the download")),
        10000,
      );
      this.conversion = { id, resolve, reject, timeout };
      this.worker.postMessage({
        action: "getDishAs",
        data: { id, dish, type: "ArrayBuffer" },
      });
    });
  }
}
