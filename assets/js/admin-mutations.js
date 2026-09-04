export function createAdminMutationController(data) {
  const controller = { state: { status: "idle" }, run };
  const inFlightByKey = new Map();

  function run(action, ...parameters) {
    const key = `${action}:${String(parameters[0])}`;
    if (inFlightByKey.has(key)) return inFlightByKey.get(key);
    if (typeof data[action] !== "function") return Promise.reject(new Error(`Unknown admin action: ${action}`));
    controller.state = { status: "working", action };
    let operation;
    try {
      operation = data[action](...parameters);
    } catch (error) {
      controller.state = { status: "failed", action, error, parameters };
      return Promise.reject(error);
    }
    const inFlight = Promise.resolve(operation)
      .then((result) => {
        controller.state = { status: result.status, action, result };
        return result;
      })
      .catch((error) => {
        controller.state = { status: "failed", action, error, parameters };
        throw error;
      })
      .finally(() => { inFlightByKey.delete(key); });
    inFlightByKey.set(key, inFlight);
    return inFlight;
  }

  return controller;
}
