import { strict as assert } from "node:assert";
import { test } from "node:test";
import { socialTitle } from "./social-title.ts";

const page = (title: string) => `<!DOCTYPE html><html><head>
  <site-head data-bascik-prop-title="${title}" data-bascik-prop-description="Summary." />
  </head><body></body></html>`;

test("social titles drop a trailing site name and decode entities", () => {
  assert.equal(socialTitle(page("Process Improvement & Technology Leadership | Rinsesoft"), "Rinsesoft"),
    "Process Improvement & Technology Leadership");
  assert.equal(socialTitle(page("Services &amp; Engagement Models | Rinsesoft"), "Rinsesoft"),
    "Services & Engagement Models");
});

test("a site name inside the title is kept", () => {
  assert.equal(socialTitle(page("About Rinsesoft | Founder-Led Systems Architecture"), "Rinsesoft"),
    "About Rinsesoft | Founder-Led Systems Architecture");
});

test("a page without a site-head title fails the build", () => {
  assert.throws(() => socialTitle("<html><head></head></html>", "Rinsesoft"), /nonempty data-bascik-prop-title/);
});
