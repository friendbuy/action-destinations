import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'

import { trackUrl } from '..'
import { base64Encode } from '../base64'
import { get } from 'lodash'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Track Customer',
  description: 'Create a customer in Friendbuy or update it if it exists.',
  defaultSubscription: 'type = "identify"',
  fields: {
    customerId: {
      label: 'Customer ID',
      description: "The user's customerId.",
      type: 'string',
      required: true,
      default: { '@path': '$.userId' }
    },
    email: {
      label: 'email',
      description: "The user's email address.",
      type: 'string',
      required: false,
      default: { '@path': '$.traits.email' }
    },
    name: {
      label: 'name',
      description: "The user's name.",
      type: 'string',
      required: false,
      default: { '@path': '$.traits.name' }
    }
  },
  perform: (request, data) => {
    // console.log("request data", JSON.stringify({request, data}, null, 2))
    const payload = base64Encode(
      encodeURIComponent(
        JSON.stringify({
          customer: { id: data.payload.customerId, email: data.payload.email, name: data.payload.name }
        })
      )
    )
    const metadata = base64Encode(
      JSON.stringify({
        url: get(data, ['rawData', 'context', 'page', 'url']),
        title: get(data, ['rawData', 'context', 'page', 'title'])
      })
    )
    return request(trackUrl, {
      method: 'get',
      searchParams: { type: 'customer', merchantId: data.settings.merchantId, metadata, payload }
    })
  }
}

export default action