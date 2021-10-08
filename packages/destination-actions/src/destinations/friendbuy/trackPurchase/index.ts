import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'

import { trackUrl } from '..'
import { base64Encode } from '../base64'

const amountSourceChoices = ['revenue', 'subtotal', 'total'] as const
type AmountSource = typeof amountSourceChoices[number]

const action: ActionDefinition<Settings, Payload> = {
  title: 'Track Purchase',
  description: 'Record a purchase in Friendbuy.',
  defaultSubscription: 'event = "Order Completed"', // see https://segment.com/docs/config-api/fql/
  // https://segment.com/docs/connections/spec/ecommerce/v2/#order-completed
  fields: {
    orderId: {
      label: 'Order ID',
      description: 'The order Id',
      type: 'string',
      required: true,
      default: { '@path': '$.properties.order_id' }
    },

    amountSource: {
      // Values available for amount:
      // - `revenue` is the sum of the costs of the items being ordered.
      // - `subtotal` is `revenue` minus any discount.
      // - `total` is `subtotal` plus tax and shipping.
      label: 'Amount Source',
      description: 'Source of purchase amount to send to Friendbuy.',
      type: 'string',
      required: true,
      choices: amountSourceChoices as unknown as string[],
      default: 'total'
    },
    revenue: {
      label: 'Revenue',
      description: 'The sum of the costs of the items being purchased.',
      type: 'number',
      required: false,
      default: { '@path': '$.properties.revenue' }
    },
    subtotal: {
      label: 'Subtotal',
      description: 'Revenue minus any discounts.',
      type: 'number',
      required: false,
      default: { '@path': '$.properties.subtotal' }
    },
    total: {
      label: 'Total',
      description: 'Subtotal plus tax and shipping.',
      type: 'number',
      required: false,
      default: { '@path': '$.properties.total' }
    },

    currency: {
      label: 'Currency',
      description: 'The currency of the purchase amount.',
      type: 'string',
      required: true,
      default: { '@path': '$.properties.currency' }
    },
    coupon: {
      // Might be used to establish attribution.
      label: 'Coupon',
      description: 'The coupon code of any coupon redeemed with the order.',
      type: 'string',
      required: false,
      default: { '@path': '$.properties.coupon' }
    },

    products: {
      label: 'Products',
      description: 'Products purchased',
      type: 'object',
      multiple: true,
      required: true,
      properties: {
        sku: {
          label: 'Product SKU',
          type: 'string',
          required: true
        },
        name: {
          label: 'Product Name',
          type: 'string',
          required: false
        },
        price: {
          label: 'Price',
          type: 'number',
          required: true
        },
        quantity: {
          label: 'Quantity (default 1)',
          type: 'integer',
          required: false
        }
      },
      default: {
        '@path': '$.properties.products'
      }
    },

    customerId: {
      label: 'Customer ID',
      description: "The user's customerId.",
      type: 'string',
      required: true,
      default: { '@path': '$.userId' }
    },

    pageUrl: {
      label: 'Page URL',
      description: 'The URL of the web page the event was generated on.',
      type: 'string',
      required: false,
      default: { '@path': '$.context.page.url' }
    },
    pageTitle: {
      label: 'Page Title',
      description: 'The title of the web page the event was generated on.',
      type: 'string',
      required: false,
      default: { '@path': '$.context.page.title' }
    },
    ipAddress: {
      label: 'IP Address',
      description: "The users's IP address.",
      type: 'string',
      required: false,
      default: { '@path': '$.context.ip' }
    },

    profile: {
      label: 'Profile Tracker',
      description: "The user's Friendbuy profile from the browser's local storage, set by friendbuy.js.",
      type: 'string',
      required: false,
      default: { '@path': '$.integrations.Actions Friendbuy.profile' }
    }
  },
  perform: (request, data) => {
    // console.log('request data', JSON.stringify({ request, data }, null, 2))
    const amount =
      data.payload[data.payload.amountSource as AmountSource] ||
      data.payload.total ||
      data.payload.subtotal ||
      data.payload.revenue
    if (amount === undefined) {
      return
    }

    const payload = base64Encode(
      encodeURIComponent(
        JSON.stringify({
          purchase: {
            id: data.payload.orderId,
            amount,
            currency: data.payload.currency,
            couponCode: data.payload.coupon,
            ...(data.payload.customerId && { customer: { id: data.payload.customerId } }),
            products: data.payload.products
          }
        })
      )
    )
    const metadata = base64Encode(
      JSON.stringify({
        url: data.payload.pageUrl,
        title: data.payload.pageTitle,
        ipAddress: data.payload.ipAddress
      })
    )
    return request(trackUrl, {
      method: 'get',
      searchParams: {
        type: 'purchase',
        merchantId: data.settings.merchantId,
        metadata,
        payload,
        ...(data.payload.profile && { tracker: data.payload.profile })
      }
    })
  }
}

export default action
