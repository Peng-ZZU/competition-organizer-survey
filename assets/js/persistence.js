function throwRpcError(error) {
  if (!error) return;
  throw new Error(error.message || "The survey service request failed.", { cause: error });
}

export function createPersistenceAdapter(client) {
  return {
    async load(name, organization) {
      const { data, error } = await client.rpc("load_survey_response", {
        p_name: name,
        p_organization: organization,
      });
      throwRpcError(error);
      return data?.[0] ?? null;
    },

    async save({ name, organization, answers, expectedVersion, allowIncomplete = false }) {
      const { data, error } = await client.rpc(allowIncomplete ? "save_partial_survey_response" : "save_survey_response", {
        p_name: name,
        p_organization: organization,
        p_answers: answers,
        p_expected_version: expectedVersion,
      });
      throwRpcError(error);
      if (!data?.[0]) throw new Error("The survey service returned no save result.");
      return data[0];
    },
  };
}

export function createSubmissionController(persistence) {
  const controller = {
    state: { status: "new" },
    submit,
    retry,
  };
  let inFlight = null;
  let lastRequest = null;

  function submit(request) {
    if (inFlight) return inFlight;
    lastRequest = request;
    controller.state = { status: "saving" };
    inFlight = persistence.save(request)
      .then((result) => {
        controller.state = { status: result.status, result };
        return result;
      })
      .catch((error) => {
        controller.state = { status: "failed", error };
        throw error;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  function retry() {
    if (!lastRequest) return Promise.reject(new Error("There is no failed submission to retry."));
    return submit(lastRequest);
  }

  return controller;
}
