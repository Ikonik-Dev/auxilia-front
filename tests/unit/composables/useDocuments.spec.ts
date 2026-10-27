import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Le SDK généré est stubbé : ces tests portent sur l'URL de téléchargement ouverte,
// qui doit être la route relative contrôlée par le serveur, jamais un chemin de stockage
// ni un hôte codé en dur.
const apiDocumentsGetCollection = vi.fn()
const apiDocumentDownloadsPost  = vi.fn()

vi.mock('@/api', () => ({
  apiDocumentsGetCollection: (...a: unknown[]) => apiDocumentsGetCollection(...a),
  apiDocumentDownloadsPost:  (...a: unknown[]) => apiDocumentDownloadsPost(...a),
}))

import { documentFileUrl, useDocuments } from '@/composables/useDocuments'
import type { DocumentDocumentRead } from '@/api'

const HOTE_EN_DUR = /^[a-z]+:\/\/|\/\/|localhost|:\d{2,5}/i

describe('documentFileUrl', () => {
  it('construit la route relative document_file', () => {
    expect(documentFileUrl(42)).toBe('/api/documents/42/file')
  })

  it("ne contient aucun hôte ni port", () => {
    expect(documentFileUrl(7)).not.toMatch(HOTE_EN_DUR)
  })
})

describe('useDocuments.downloadDocument', () => {
  let openSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    apiDocumentDownloadsPost.mockReset().mockResolvedValue({ data: {} })
    openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("ouvre /api/documents/{id}/file, pas le filePath", async () => {
    const doc = { id: 5, filePath: 'uploads/documents/stockage.pdf' } as DocumentDocumentRead
    const { downloadDocument } = useDocuments()

    await downloadDocument(doc)

    expect(openSpy).toHaveBeenCalledTimes(1)
    const url = String(openSpy.mock.calls[0]![0])
    expect(url).toBe('/api/documents/5/file')
    expect(url).not.toContain('uploads')
    expect(url).not.toMatch(HOTE_EN_DUR)
  })

  it("n'ouvre rien sans identifiant", async () => {
    const { downloadDocument } = useDocuments()
    await downloadDocument({} as DocumentDocumentRead)
    expect(openSpy).not.toHaveBeenCalled()
  })
})
