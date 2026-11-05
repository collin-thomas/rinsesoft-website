import { parse } from "parse5";

type Node = { nodeName: string; attrs?: { name: string; value: string }[]; childNodes?: Node[]; content?: Node };

function findSiteHead(node: Node): Node | undefined {
  if (node.nodeName === "site-head") return node;
  for (const child of [...(node.childNodes ?? []), ...(node.content ? [node.content] : [])]) {
    const found = findSiteHead(child);
    if (found) return found;
  }
}

// Apple's TN3156: keep the site name out of og:title; og:site_name carries it.
export function socialTitle(pageSource: string, siteName: string): string {
  const siteHead = findSiteHead(parse(pageSource) as Node);
  const title = siteHead?.attrs?.find((attr) => attr.name === "data-bascik-prop-title")?.value.trim();
  if (!title) throw new Error("<site-head> requires a nonempty data-bascik-prop-title.");
  return title.replace(new RegExp(`\\s*[|:-]\\s*${siteName}$`), "").trim() || title;
}
