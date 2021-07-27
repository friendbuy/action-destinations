import '../aliases'
import '../lib/patch-http'
import express from 'express'
import { NotFound } from 'http-errors'
import ow from 'ow'
import core from '@/middleware/core'
import errorHandler from '@/middleware/error-handler'
import { startServer } from '@/boot'
import { PORT } from '@/config'
import asyncHandler from '@/lib/async-handler'
import { getDestinationByIdOrSlug } from '@segment/destination-actions'
import { controlPlaneService } from '@/services/control-plane-service'
import Context from '@/lib/context'

const app = express()

app.disable('x-powered-by')

// Causes `req.ip` to be set to the `X-Forwarded-For` header value, which is set by the ELB
app.set('trust proxy', true)

// Endpoint used by ECS to check that the server is still alive
app.get('/health', (_req, res) => {
  res.status(204).end()
})

app.use(core)

app.use(express.json())

async function fetchDestinationSettings(
  context: Context,
  authorization: string,
  destinationId: string
): Promise<object> {
  const { error, data } = await controlPlaneService.getDestinationById(
    { authorization },
    {
      destinationId,
      showEncryptedSettings: true
    },
    { context }
  )

  if (error) {
    throw error
  }

  if (!data?.destination.settings) {
    throw new NotFound('No destination with that id was found.')
  }

  return data.destination.settings
}

app.post(
  '/autocomplete',
  asyncHandler(async (req, res) => {
    const { destinationId, destinationSlug, metadataId, action, field, mapping, page } = req.body

    ow(field, ow.string)
    ow(mapping, ow.optional.object)
    ow(page, ow.optional.string)

    let settings = req.body.settings

    if (destinationId) {
      settings = await fetchDestinationSettings(req.context, req.headers.authorization as string, destinationId)
    }

    ow(settings, ow.optional.object)

    // fallback to slug when metadataId is not provided
    const destinationDefinition = await getDestinationByIdOrSlug(metadataId ?? destinationSlug)
    if (!destinationDefinition) {
      res.status(200).json({ data: [], pagination: {} })
      return
    }

    ow(action, ow.string.oneOf(Object.keys(destinationDefinition.actions)))
    req.context.set('req_destination', destinationDefinition.name)
    req.context.set('req_action', action)

    const actionDefinition = destinationDefinition.actions[action]

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await actionDefinition.executeDynamicField(field, {
        payload: mapping,
        settings,
        page
      })

      res.status(200).json({
        data: result.data,
        pagination: {
          nextPage: result.pagination.nextPage
        }
      })
    } catch {
      res.status(200).json({
        data: [],
        pagination: {}
      })
    }
  })
)

app.post(
  '/test-credentials',
  asyncHandler(async (req, res) => {
    const { destination, metadataId, settings } = req.body

    ow(settings, ow.object)

    // fallback to slug when metadataId is not provided
    const destinationDefinition = await getDestinationByIdOrSlug(metadataId ?? destination)

    if (!destinationDefinition) {
      res.status(404).json({ ok: false, error: `No destination found by ${metadataId ?? destination}` })
      return
    }

    req.context.set('req_destination', destinationDefinition.name)

    try {
      await destinationDefinition.testAuthentication(settings)
      res.status(200).json({ ok: true })
    } catch (error) {
      if (error.name === 'AggregateAjvError') {
        const fields: Record<string, string> = {}

        for (const fieldError of error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const name = fieldError.path.replace('$.', '')
          fields[name] = fieldError.message
        }

        res.status(200).json({
          ok: false,
          error: 'Credentials are invalid',
          fields
        })

        return
      }

      res.status(200).json({
        ok: false,
        error: error.message
      })
    }
  })
)

app.post(
  '/test-action',
  asyncHandler(async (req, res) => {
    const { destinationId, destinationSlug, metadataId, action, event, mapping } = req.body

    ow(destinationId, ow.optional.string)
    ow(metadataId, ow.optional.string)
    ow(destinationSlug, ow.string)
    ow(event, ow.object)
    ow(mapping, ow.object)

    let settings = req.body.settings

    if (destinationId) {
      settings = await fetchDestinationSettings(req.context, req.headers.authorization as string, destinationId)
    }

    ow(settings, ow.optional.object)

    const destinationDefinition = await getDestinationByIdOrSlug(metadataId ?? destinationSlug)
    if (!destinationDefinition) {
      res.status(404).json({
        ok: false,
        response: `No destination found by ${metadataId ?? destinationSlug}`
      })
      return
    }

    ow(action, ow.string.oneOf(Object.keys(destinationDefinition.actions)))
    req.context.set('req_destination', destinationDefinition.name)
    req.context.set('req_action', action)

    const actionDefinition = destinationDefinition.actions[action]

    try {
      const results = await actionDefinition.execute({
        settings,
        data: event,
        mapping
      })

      const response = results[results.length - 1]?.output ?? ''

      res.status(200).json({
        ok: true,
        response: JSON.stringify(response, null, '\t')
      })
    } catch (error) {
      let response: string = error.message
      const responseBody = error.response?.data ?? error.response?.body

      if (Buffer.isBuffer(responseBody) || typeof responseBody === 'string') {
        response = responseBody.toString()
      } else if (typeof responseBody === 'object') {
        response = JSON.stringify(responseBody)
      }

      res.status(200).json({
        ok: false,
        response
      })
    }
  })
)

app.use(errorHandler)

export default startServer(app, Number(PORT || 3001))
