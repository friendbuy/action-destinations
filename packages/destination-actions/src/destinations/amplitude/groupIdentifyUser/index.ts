import { ActionDefinition } from '../../../lib/destination-kit/action'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import dayjs from '../../../lib/dayjs'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Group Identify User',
  description:
    'Set or update properties of particular groups. Note that these updates will only affect events going forward.',
  recommended: false,
  defaultSubscription: 'type = "group"',
  fields: {
    user_id: {
      title: 'User ID',
      type: ['string', 'null'],
      description:
        'A UUID (unique user ID) specified by you. **Note:** If you send a request with a user ID that is not in the Amplitude system yet, then the user tied to that ID will not be marked new until their first event. Required unless device ID is present.',
      default: {
        '@path': '$.userId'
      }
    },
    device_id: {
      title: 'Device ID',
      type: 'string',
      description:
        'A device specific identifier, such as the Identifier for Vendor (IDFV) on iOS. Required unless user ID is present.',
      default: {
        '@if': {
          exists: { '@path': '$.context.device.id' },
          then: { '@path': '$.context.device.id' },
          else: { '@path': '$.anonymousId' }
        }
      }
    },
    insert_id: {
      title: 'Insert ID',
      type: 'string',
      description:
        'Amplitude will deduplicate subsequent events sent with this ID we have already seen before within the past 7 days. Amplitude recommends generating a UUID or using some combination of device ID, user ID, event type, event ID, and time.'
    },
    time: {
      title: 'Timestamp',
      type: 'string',
      format: 'date-time',
      description:
        'The timestamp of the event. If time is not sent with the event, it will be set to the request upload time.',
      default: {
        '@path': '$.timestamp'
      }
    },
    group_properties: {
      title: 'Group Properties',
      type: 'object',
      description: 'Additional data tied to the group in Amplitude.',
      default: {
        '@path': '$.traits'
      }
    },
    group_type: {
      title: 'Group Type',
      type: 'string',
      description: '',
      required: true
    },
    group_value: {
      title: 'Group Value',
      type: 'string',
      description: '',
      required: true
    }
  },
  perform: async (request, { payload, settings }) => {
    const groupAssociation = { [payload.group_type]: payload.group_value }

    // Associate user to group
    await request.post('https://api.amplitude.com/identify', {
      form: {
        api_key: settings.apiKey,
        identification: JSON.stringify([
          {
            device_id: payload.device_id,
            groups: groupAssociation,
            insert_id: payload.insert_id,
            library: 'segment',
            time: dayjs.utc(payload.time).valueOf(),
            user_id: payload.user_id,
            user_properties: groupAssociation
          }
        ])
      }
    })

    // Associate group properties
    return request.post('https://api.amplitude.com/groupidentify', {
      form: {
        api_key: settings.apiKey,
        identification: JSON.stringify([
          {
            group_properties: payload.group_properties,
            group_value: payload.group_value,
            group_type: payload.group_type,
            library: 'segment'
          }
        ])
      }
    })
  }
}

export default action
