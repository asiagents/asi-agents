# Virtual Computer

**UI name:** Virtual Computer · **Package:** `@asi-agents/virtual-computer`

Ships with ASI Agents. Core chat never depends on Desk.

## Out of the box

- Module is installed; `/desk` and status probes work immediately.
- Desk daemon on `:3456` is **optional**. Autostart (`ASI_DESK_AUTOSTART=1` local default) only runs when `ASI_DESK_REPO` (or `DESK_ROOT`) points at a Desk install.
- Without Desk: status is honestly offline — no fake desks, no long setup path required.

## Optional Desk

```powershell
$env:ASI_DESK_REPO = "<path-to-desk-install>"
# then start ASI Agents — or open /desk and use Start when Python + daemon are available
```
