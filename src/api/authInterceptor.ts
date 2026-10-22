/**
 * Renouvellement de session sur 401 (lot 1.1b, F1).
 *
 * Le jeton d'accès (cookie HttpOnly) a une durée de vie limitée : il EXPIRE en cours de
 * navigation. Sans ce module, la première requête SDK après l'expiration rendait 401 et l'écran affichait une
 * erreur ; seul un rechargement complet de la page relançait un refresh.
 *
 * Contrat :
 *  - une réponse 401 déclenche UN refresh puis UN rejeu de la requête d'origine ;
 *  - plusieurs 401 simultanés partagent UN seul refresh (verrou) : le jeton de rafraîchissement
 *    est à usage unique côté serveur, deux refresh concurrents se feraient échouer l'un l'autre ;
 *  - une requête partie AVANT la fin d'un refresh n'en relance pas un second, elle est rejouée ;
 *  - les routes `/api/auth/*` ne sont jamais rejouées ni rafraîchies (login raté, refresh refusé) ;
 *  - seule une session définitivement perdue déconnecte ; 429, réseau et timeout sont
 *    « transitoires » : la requête garde son 401, l'utilisateur reste connecté.
 */

/** Issue d'une tentative de renouvellement. */
export type RefreshOutcome = 'refreshed' | 'lost' | 'transient'

export interface RefreshCoordinator {
  /** Lance le refresh, ou rejoint celui qui est en cours. */
  run(doRefresh: () => Promise<RefreshOutcome>): Promise<RefreshOutcome>
  /** Nombre de refresh réussis depuis la création. */
  readonly epoch: number
}

export function createRefreshCoordinator(): RefreshCoordinator {
  let inflight: Promise<RefreshOutcome> | null = null
  let epoch = 0
  return {
    run(doRefresh) {
      inflight ??= doRefresh()
        .then((outcome) => {
          if (outcome === 'refreshed') epoch++
          return outcome
        })
        .finally(() => {
          inflight = null
        })
      return inflight
    },
    get epoch() {
      return epoch
    },
  }
}

/** Verrou partagé par l'intercepteur, le store d'authentification et le garde de routeur. */
export const refreshCoordinator: RefreshCoordinator = createRefreshCoordinator()

/** Sous-ensemble du client généré dont dépend l'intercepteur. */
export interface InterceptableClient {
  interceptors: {
    request: { use(fn: (request: Request) => Request | Promise<Request>): unknown }
    response: {
      use(
        fn: (
          response: Response,
          request: Request,
          options: { fetch?: typeof fetch },
        ) => Response | Promise<Response>,
      ): unknown
    }
  }
}

export interface AuthInterceptorDeps {
  /** Renouvelle la session (POST /api/auth/refresh, hors client intercepté). */
  doRefresh: () => Promise<RefreshOutcome>
  /** La session est définitivement perdue : effacer l'état et rediriger vers /login. */
  onSessionLost: () => void
  /** Verrou ; par défaut celui de l'application. Les tests passent le leur. */
  coordinator?: RefreshCoordinator
}

const AUTH_PREFIX = '/api/auth/'

export function installAuthInterceptor(client: InterceptableClient, deps: AuthInterceptorDeps): void {
  const coordinator = deps.coordinator ?? refreshCoordinator

  // Le corps d'une requête n'est lisible qu'une fois : on en garde une copie AVANT l'envoi,
  // avec le numéro de refresh en vigueur à cet instant.
  const sent = new WeakMap<Request, { copy: Request; epoch: number }>()

  client.interceptors.request.use((request) => {
    sent.set(request, { copy: request.clone(), epoch: coordinator.epoch })
    return request
  })

  client.interceptors.response.use(async (response, request, options) => {
    if (response.status !== 401) return response
    if (new URL(request.url, 'http://localhost').pathname.startsWith(AUTH_PREFIX)) return response

    const memo = sent.get(request)
    if (!memo) return response

    // Aucun refresh réussi depuis l'envoi de CETTE requête : c'est à nous d'en obtenir un.
    if (memo.epoch === coordinator.epoch) {
      const outcome = await coordinator.run(deps.doRefresh)
      if (outcome === 'lost') deps.onSessionLost()
      if (outcome !== 'refreshed') return response
    }

    // Un seul rejeu, hors intercepteurs. `fetch` est appelé SANS objet receveur : appelé comme
    // méthode de `options`, le fetch du navigateur lève « Illegal invocation ».
    const replay = options.fetch ?? globalThis.fetch
    return replay(memo.copy)
  })
}
