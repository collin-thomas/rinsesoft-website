import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ogContent } from "./og-content.ts";

test("OG cards use the visible page headline rather than the SEO title", () => {
  const source = `<!doctype html><html><head>
    <title>Process Improvement &amp; Fractional CTO Consulting | Rinsesoft</title>
    <meta name="description" content="Hands-on help for this business.">
    </head><body><h1>Stronger operations.
      <span>Greater capacity to grow.</span></h1></body></html>`;
  assert.deepEqual(ogContent(source, "index.html"), {
    headline: "Stronger operations. Greater capacity to grow.",
    description: "Hands-on help for this business.",
  });
});

test("each page supplies its own headline and decoded summary", () => {
  assert.deepEqual(ogContent(`<meta name="description" content="Knowledge &amp; continuity.">
    <h1>Keep <em>your</em> business knowledge.</h1>`, "knowledge.html"), {
    headline: "Keep your business knowledge.",
    description: "Knowledge & continuity.",
  });
});

test("missing, empty, or ambiguous page content fails instead of using a generic title", () => {
  for (const source of [
    '<title>Generic title</title><meta name="description" content="Summary.">',
    '<h1> </h1><meta name="description" content="Summary.">',
    '<h1>First</h1><h1>Second</h1><meta name="description" content="Summary.">',
    "<h1>Headline</h1>",
  ]) {
    assert.throws(() => ogContent(source, "broken.html"), /exactly one nonempty h1.*broken\.html/);
  }
});
