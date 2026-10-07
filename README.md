# TekstOntleder

Visualiseert de herkomst van tekst in een LJSON-document (`example.ljson`): welke delen
door een mens zijn geschreven, door AI zijn gegenereerd of uit een ander document zijn
gekopieerd. UI volgens het NLDD Design System (`@nldd/design-system`).

## Starten

```sh
uv sync && uv run python -m backend.main          # API op http://127.0.0.1:8010
cd frontend && npm install && npm run dev          # UI op http://localhost:5180
```

`/api/document` levert `example.ljson`, gevalideerd met het `LJSONDocument`-model.
`/api/document?variant=nested` levert `example_nested.ljson` (geneste fragmenten);
in de UI via `?voorbeeld=genest`.

## Tests

```sh
uv run pytest backend
cd frontend && npm test && npm run build
```

## Opbouw

- `frontend/src/lib/segment.ts` — bouwt uit de spans een boom op basis van
  index-insluiting en knipt de tekst in een geordende lijst van gaten en (geneste)
  fragmenten. Gedeeltelijke overlap wordt op de grens van de ouder gesplitst.
- `frontend/src/components/SegmentList.vue` — rendert de boom recursief (Vue 3). Het buitenste
  zichtbare fragment krijgt een achtergrondtint, geneste fragmenten een dikke
  onderstreping in hun eigen kleur en lijnstijl (nooit gestapelde achtergronden).
- `frontend/src/components/SpanPopover.vue` — één gedeelde `nldd-popover` met de
  metadata; aanwijzen opent hem tijdelijk, klikken of Enter zet hem vast.

## Deployment (zelfde omgeving als invulhulp en regiekamer)

`azure-pipelines.yml` bouwt `tekstontleder-backend` en `tekstontleder-frontend` naar de ACR
van `rg-invulhulp-inno-d` en rolt twee Container Apps uit in `cae-invulhulp-inno-d`:

- `ca-tekstontleder-backend-inno-d` — intern, poort 8000. Geen opslag en geen model nodig.
- `ca-tekstontleder-frontend-inno-d` — extern, nginx proxyt `/api` naar de backend, achter
  dezelfde IP-allowlist als invulhulp (variabelengroep `invulhulp-secrets`).

Eenmalig: geef de pipeline toegang tot de variabelengroep `invulhulp-secrets`, registreer
`azure-pipelines.yml` in Azure DevOps en draai hem op `main`.

Lokaal de productie-images draaien: `docker compose up --build` → http://localhost:8080.
