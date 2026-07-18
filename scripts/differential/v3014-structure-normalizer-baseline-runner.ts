#!/usr/bin/env bun
import { extractStructureTrees } from "./src/pdf/extractor.ts";
const raw = {
  role: "  ",
  alt: "leak",
  lang: "leak",
  bbox: [1, 2, 3, 4],
  mathML: "leak",
  children: [
    null,
    7,
    "primitive",
    { type: " ", id: " abc ", alt: "leak" },
    { id: " only " },
    { type: "object" },
    {
      role: " ",
      lang: "leak",
      children: [
        { type: 7, id: 9 },
        { type: "", id: "" },
      ],
    },
    { children: "not-array" },
    { type: "", id: "" },
  ],
};
const pdf = { getPage: async () => ({ getStructTree: async () => raw }) };
console.log(
  JSON.stringify((await extractStructureTrees(pdf as never, [1]))[0]!.tree)
);
