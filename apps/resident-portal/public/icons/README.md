# Service icons — required assets, not yet delivered

The design export references `icons/<name>.png` for the sidebar service marks, and
Ruling 1 (UI-028-ST) directs bundling them here. **They are absent from the design
handoff:** both `Property management End User portal design.zip` and the management
bundle ship four files each (`*.dc.html`, `*(standalone).html`, `support.js`,
`README.md`) and **no `icons/` folder**; the standalone HTML embeds no image data.

Drop the real PNGs here and run `pnpm run generate`. `tool/generate-icons.ts`
rebuilds `src/data/icons.g.ts`, and each service whose PNG is present renders it;
the rest reserve their slot and rely on the label. No broken image ever ships.

Required basenames (from the export's `SERVICES.img` mapping):

    clubhouse.png   documents.png   reports.png   cases.png
    helpdesk.png    notices.png     visitor.png   access.png

`passes`, `bills` and `community` are text glyphs in the export itself and need no PNG.

The export README claims this set "matches the management console exactly." It does
not — the management web's accepted divergence A2 is *menu items text-only, no
icons*. See DIVERGENCES.md, addressed to the later management design pass.
