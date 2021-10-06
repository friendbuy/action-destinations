import type { Settings } from './generated-types'
import type { BrowserDestinationDefinition } from '../../lib/browser-destinations'
import { browserDestination } from '../../runtime/shim'

// Switch from unknown to the partner SDK client types
export const destination: BrowserDestinationDefinition<Settings, unknown> = {
  name: 'Friendbuy Plugins',
  slug: 'friendbuy-plugins',
  mode: 'device',

  settings: {
    // Add any Segment destination settings required here
  },

  initialize: async ({ _settings, _analytics }, deps) => {
    await deps.loadScript('<path_to_partner_script>')
    // initialize client code here
  },

  actions: {}
}

export default browserDestination(destination)