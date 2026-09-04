import { normalizeIdentity } from "./survey-logic.js";

export function draftKey({ name, organization }) {
  return `survey-draft:${normalizeIdentity(name)}|${normalizeIdentity(organization)}`;
}

export function createDraftStore(storage) {
  return {
    save(identity, draft) {
      try {
        storage.setItem(draftKey(identity), JSON.stringify(draft));
        return true;
      } catch {
        return false;
      }
    },
    load(identity) {
      try {
        const value = storage.getItem(draftKey(identity));
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    },
    clear(identity) {
      try {
        storage.removeItem(draftKey(identity));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function decideInitialSource(serverResponse, draft) {
  if (!draft) return { defaultSource: serverResponse ? "server" : "blank", canRestoreDraft: false };
  if (!serverResponse) return { defaultSource: "draft", canRestoreDraft: true };
  const draftTime = Date.parse(draft.savedAt);
  const serverTime = Date.parse(serverResponse.updated_at);
  return {
    defaultSource: Number.isFinite(draftTime) && draftTime > serverTime ? "draft" : "server",
    canRestoreDraft: true,
  };
}
