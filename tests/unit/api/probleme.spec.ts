import { describe, it, expect } from 'vitest'
import { typeDuProbleme } from '@/api/probleme'

/**
 * Chantier A6 — lire le `type` RFC 7807 d'un corps d'erreur sans cast (16 septembre 2026).
 *
 * Le client généré rend en `error` le corps PARSÉ s'il est JSON, sinon le TEXTE brut. Toutes ces
 * formes arrivent réellement : aucune ne doit lever, aucune ne doit inventer un `type`.
 */
describe("typeDuProbleme", () => {
  it("rend le type d'un corps problem+json", () => {
    expect(typeDuProbleme({ type: "urn:auxilium:inscription:en-double", status: 409 })).toBe("urn:auxilium:inscription:en-double")
  })

  it.each([
    ["un corps texte (réponse non JSON)", "Internal Server Error"],
    ["null", null],
    ["undefined", undefined],
    ["un objet sans type", { status: 500, detail: "x" }],
    ["un type non chaîne", { type: 409 }],
    ["un tableau", ["urn:auxilium:inscription:en-double"]],
  ])("rend null pour %s", (_nom, corps) => {
    expect(typeDuProbleme(corps)).toBeNull()
  })
})
