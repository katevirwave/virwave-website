# Lessons

## Never invent visual assets from a type name

When the marketing site needs to render something the app already renders
(archetype shapes, phase glyphs, aura visuals, etc.), the source of truth is
the **rendering component in `virwave_v3`**, not the type name in a domain
file.

Example: `archetypes.ts` exports `shapeId: 'box' | 'pentagon' | ...` — that
gives names only. The actual SVG geometry lives in
`src/ui/ArchetypeShapeMark.tsx`. Always open the renderer and copy paths
verbatim (with matching viewBox and stroke width) rather than drawing new
shapes freehand.

Rule: if the website has to depict something the user will also see in the
app, grep `virwave_v3/src/` for the component that renders it and mirror it
exactly. If no such component exists, flag it to Kate before shipping an
invented version.
