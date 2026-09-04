import { expect, test } from "@playwright/test";

const activeResponse = {
  id: "one",
  respondent_name: "Jane Li",
  organization: "ABC University",
  normalized_organization: "abc university",
  answers: { q02: "Yes", q03: "10+" },
  version: 1,
  created_at: "2026-09-01T01:00:00Z",
  updated_at: "2026-09-02T01:00:00Z",
  deleted_at: null,
  deleted_by: null,
};

async function installRecycleRuntime(page, { initiallyDeleted = false, failSoftDelete = false, softDeleteStatus = "deleted" } = {}) {
  await page.addInitScript(({ response, initiallyDeleted, failSoftDelete, softDeleteStatus }) => {
    let active = initiallyDeleted ? [] : [structuredClone(response)];
    let deleted = initiallyDeleted ? [{ ...structuredClone(response), version: 2, deleted_at: "2026-09-04T01:00:00Z", deleted_by: "admin-user" }] : [];
    window.__recycleCalls = [];
    window.__recycleLoads = 0;
    window.__ADMIN_RUNTIME__ = {
      auth: {
        async getSession() { return { user: { email: "admin@example.com" } }; },
        async signOut() {},
        onAuthStateChange() { return () => {}; },
      },
      data: {
        async loadResponses() { window.__recycleLoads += 1; return structuredClone(active); },
        async loadDeletedResponses() { return structuredClone(deleted); },
        async softDelete(id, version) {
          window.__recycleCalls.push(["softDelete", id, version]);
          if (failSoftDelete) throw new Error("offline");
          if (softDeleteStatus !== "deleted") return { status: softDeleteStatus, response_id: id, response_version: version };
          const item = active.find((entry) => entry.id === id);
          active = active.filter((entry) => entry.id !== id);
          deleted = [{ ...item, version: version + 1, deleted_at: "2026-09-04T02:00:00Z", deleted_by: "admin-user" }, ...deleted];
          return { status: "deleted", response_id: id, response_version: version + 1 };
        },
        async restore(id, version) {
          window.__recycleCalls.push(["restore", id, version]);
          const item = deleted.find((entry) => entry.id === id);
          deleted = deleted.filter((entry) => entry.id !== id);
          active = [{ ...item, version: version + 1, deleted_at: null, deleted_by: null }, ...active];
          return { status: "restored", response_id: id, response_version: version + 1 };
        },
        async permanentlyDelete(id, version, name) {
          window.__recycleCalls.push(["permanentlyDelete", id, version, name]);
          deleted = deleted.filter((entry) => entry.id !== id);
          return { status: "permanently_deleted", response_id: id };
        },
      },
    };
  }, { response: activeResponse, initiallyDeleted, failSoftDelete, softDeleteStatus });
  await page.goto("/admin.html");
}

test("admin can cancel, soft delete, and restore a response", async ({ page }) => {
  await installRecycleRuntime(page);
  await page.getByRole("button", { name: "Respondents" }).click();
  const deleteButton = page.getByRole("button", { name: "Delete response for Jane Li" });
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Move response for Jane Li to Deleted Responses" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(deleteButton).toBeFocused();
  expect(await page.evaluate(() => window.__recycleCalls.length)).toBe(0);

  await deleteButton.click();
  await dialog.getByRole("button", { name: "Move to Deleted Responses" }).click();
  await expect(page.getByText("No responses yet")).toBeVisible();
  await expect(page.getByTestId("deleted-count")).toHaveText("1");
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByTestId("completed-responses")).toHaveText("0");
  await page.getByRole("button", { name: /Deleted Responses/ }).click();
  await expect(page.getByRole("heading", { name: "Jane Li", exact: true })).toBeVisible();
  await expect(page.getByText("Deleted by admin-user")).toBeVisible();
  await page.getByRole("button", { name: "Restore response for Jane Li" }).click();
  await expect(page.getByText("No deleted responses")).toBeVisible();
  await page.getByRole("button", { name: "Respondents" }).click();
  await expect(page.getByRole("heading", { name: "Jane Li", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByTestId("completed-responses")).toHaveText("1");
});

test("permanent delete requires exact respondent name", async ({ page }) => {
  await installRecycleRuntime(page, { initiallyDeleted: true });
  await page.getByRole("button", { name: /Deleted Responses/ }).click();
  await page.getByRole("button", { name: "Delete permanently response for Jane Li" }).click();
  const dialog = page.getByRole("dialog", { name: "Permanently delete response for Jane Li" });
  const confirm = dialog.getByRole("button", { name: "Delete permanently" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type Jane Li to confirm").fill("Jane");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type Jane Li to confirm").fill("Jane Li");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByText("No deleted responses")).toBeVisible();
});

test("failed soft delete keeps the record and offers retry", async ({ page }) => {
  await installRecycleRuntime(page, { failSoftDelete: true });
  await page.getByRole("button", { name: "Respondents" }).click();
  await page.getByRole("button", { name: "Delete response for Jane Li" }).click();
  const dialog = page.getByRole("dialog", { name: "Move response for Jane Li to Deleted Responses" });
  await dialog.getByRole("button", { name: "Move to Deleted Responses" }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not be moved");
  await expect(dialog.getByRole("button", { name: "Move to Deleted Responses" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Jane Li", exact: true })).toBeVisible();
});

test("stale soft delete reloads current data instead of retrying stale version", async ({ page }) => {
  await installRecycleRuntime(page, { softDeleteStatus: "conflict" });
  await page.getByRole("button", { name: "Respondents" }).click();
  const initialLoads = await page.evaluate(() => window.__recycleLoads);
  await page.getByRole("button", { name: "Delete response for Jane Li" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Move to Deleted Responses" }).click();
  await expect(page.getByRole("alert")).toContainText("latest data has been reloaded");
  expect(await page.evaluate(() => window.__recycleLoads)).toBeGreaterThan(initialLoads);
  await expect(page.getByRole("button", { name: "Delete response for Jane Li" })).toBeVisible();
});

test("recycle-bin interface fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installRecycleRuntime(page, { initiallyDeleted: true });
  await page.getByRole("button", { name: /Deleted Responses/ }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
