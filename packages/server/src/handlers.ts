// Server handlers — the defaults from @agent-desk/core are sufficient for the
// web target. Any server-specific override (e.g. read-only mode filtering)
// would spread into the returned map here.

import { buildDefaultRequestHandlers, buildDefaultCommandHandlers, type BuildHandlersDeps } from '@agent-desk/core';

export type { BuildHandlersDeps };

export function buildRequestHandlers(deps: BuildHandlersDeps) {
  return buildDefaultRequestHandlers(deps);
}

export function buildCommandHandlers(deps: BuildHandlersDeps) {
  return buildDefaultCommandHandlers(deps);
}
